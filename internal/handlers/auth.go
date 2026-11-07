package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/hearth-platform/hearth/internal/database"
	"github.com/hearth-platform/hearth/internal/middleware"
	"github.com/hearth-platform/hearth/internal/models"
	"google.golang.org/api/idtoken"
)

func issueAccessToken(user models.User) (string, error) {
	claims := &middleware.Claims{
		UserID:   user.ID,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	secret := middleware.JWTSecret()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func generateRandomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func issueRefreshToken(userID uint, familyID string) (string, error) {
	token, err := generateRandomToken()
	if err != nil {
		return "", err
	}

	if familyID == "" {
		familyID, err = generateRandomToken()
		if err != nil {
			return "", err
		}
	}

	rt := models.RefreshToken{
		UserID:    userID,
		Token:     token,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		FamilyID:  familyID,
	}

	if err := database.DB.Create(&rt).Error; err != nil {
		return "", err
	}

	return token, nil
}

func setRefreshTokenCookie(c *gin.Context, token string) {
	secure := os.Getenv("ENV") == "production" || os.Getenv("APP_ENV") == "production"
	c.SetSameSite(http.SameSiteNoneMode)
	c.SetCookie("refresh-token", token, int(7*24*time.Hour/time.Second), "/", "", secure, true)
}

func clearRefreshTokenCookie(c *gin.Context) {
	secure := os.Getenv("ENV") == "production" || os.Getenv("APP_ENV") == "production"
	c.SetSameSite(http.SameSiteNoneMode)
	c.SetCookie("refresh-token", "", -1, "/", "", secure, true)
}

type GoogleLoginRequest struct {
	Credential string `json:"credential" binding:"required"`
}

// ── Username + password (invite-gated) ──

type RegisterRequest struct {
	Username   string `json:"username" binding:"required,min=3,max=30,alphanum"`
	Password   string `json:"password" binding:"required,min=8,max=100"`
	InviteCode string `json:"invite_code" binding:"required"`
}

func generateInviteCode() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return strings.ToUpper(hex.EncodeToString(b)), nil
}

func RegisterHandler(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username (3–30, letters/numbers), password (min 8) and invite code required"})
		return
	}

	var invite models.InviteCode
	if err := database.DB.Where("code = ?", strings.ToUpper(req.InviteCode)).First(&invite).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Invalid invite code"})
		return
	}
	if invite.UsedAt != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Invite code already used"})
		return
	}
	if invite.ExpiresAt != nil && time.Now().After(*invite.ExpiresAt) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Invite code expired"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process account"})
		return
	}

	user := models.User{
		Username: strings.TrimSpace(req.Username),
		Email:    req.Username + "@hearth.local", // unique placeholder: local accounts have no external email
		Password: string(hash),
		Name:     req.Username,
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		now := time.Now()
		invite.UsedByID = &user.ID
		invite.UsedAt = &now
		return tx.Save(&invite).Error
	})
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	issueSession(c, user)
}

type PasswordLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func LoginHandler(c *gin.Context) {
	var req PasswordLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username and password required"})
		return
	}

	var user models.User
	if err := database.DB.Where("username = ?", strings.TrimSpace(req.Username)).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	issueSession(c, user)
}

// issueSession: shared response for both login paths (JWT + rotating refresh cookie).
func issueSession(c *gin.Context, user models.User) {
	accessToken, err := issueAccessToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token."})
		return
	}
	refreshToken, err := issueRefreshToken(user.ID, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate session."})
		return
	}
	setRefreshTokenCookie(c, refreshToken)

	c.JSON(http.StatusOK, gin.H{
		"token": accessToken,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"avatar":   user.Avatar,
			"name":     user.Name,
			"bio":      user.Bio,
		},
	})
}

// ── Admin invites ──

func CreateInvite(c *gin.Context) {
	userID := c.GetUint("user_id")
	if !isAdmin(userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	code, err := generateInviteCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate code"})
		return
	}

	invite := models.InviteCode{Code: code, CreatedBy: userID}
	if err := database.DB.Create(&invite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invite"})
		return
	}

	c.JSON(http.StatusCreated, invite)
}

func ListInvites(c *gin.Context) {
	userID := c.GetUint("user_id")
	if !isAdmin(userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var invites []models.InviteCode
	// used_by is *User with Password json:"-": usernames visible, passwords never serialized.
	if err := database.DB.Preload("UsedBy").Order("created_at DESC").Find(&invites).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invites"})
		return
	}

	c.JSON(http.StatusOK, invites)
}

func DeleteInvite(c *gin.Context) {
	userID := c.GetUint("user_id")
	if !isAdmin(userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var invite models.InviteCode
	if err := database.DB.First(&invite, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found"})
		return
	}
	if invite.UsedAt != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Used invites cannot be deleted"})
		return
	}
	if err := database.DB.Delete(&invite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete invite"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invite deleted"})
}

func GoogleLogin(c *gin.Context) {
	var req GoogleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	payload, err := idtoken.Validate(context.Background(), req.Credential, clientID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Google token"})
		return
	}

	email, ok := payload.Claims["email"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email not provided by Google"})
		return
	}

	name, _ := payload.Claims["name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	var user models.User
	if err := database.DB.Where("email=?", email).First(&user).Error; err != nil {
		// User doesn't exist, create them
		user = models.User{
			Email:    email,
			Username: strings.Split(email, "@")[0],
			Name:     name,
			Avatar:   picture,
			Password: "", // No password needed for OAuth users
		}
		if err := database.DB.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}
	}

	accessToken, err := issueAccessToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token."})
		return
	}

	refreshToken, err := issueRefreshToken(user.ID, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate session."})
		return
	}

	setRefreshTokenCookie(c, refreshToken)

	c.JSON(http.StatusOK, gin.H{
		"token": accessToken,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"avatar":   user.Avatar,
			"name":     user.Name,
			"bio":      user.Bio,
		},
	})
}

func GetMe(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var user models.User

	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User Not Found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"avatar":   user.Avatar,
			"name":     user.Name,
			"bio":      user.Bio,
		},
	})
}

type UpdateProfileRequest struct {
	Name     string `json:"name" binding:"max=100"`
	Bio      string `json:"bio"`
	Username string `json:"username" binding:"required,min=3,max=50"`
}

func UpdateProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	var existingUser models.User
	if err := database.DB.Where("username = ? AND id != ?", req.Username, userID).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User Not Found"})
		return
	}

	user.Name = req.Name
	user.Bio = req.Bio
	user.Username = req.Username

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully",
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"avatar":   user.Avatar,
			"name":     user.Name,
			"bio":      user.Bio,
		},
	})
}

func RefreshTokenHandler(c *gin.Context) {
	cookieToken, err := c.Cookie("refresh-token")
	if err != nil || cookieToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token required"})
		return
	}

	var rt models.RefreshToken
	if err := database.DB.Where("token = ?", cookieToken).First(&rt).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}

	// Reuse detection
	if rt.Used || rt.Revoked {
		// Revoke the entire token family
		database.DB.Model(&models.RefreshToken{}).
			Where("family_id = ?", rt.FamilyID).
			Update("revoked", true)

		clearRefreshTokenCookie(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Compromised session. Please log in again."})
		return
	}

	// Check expiration
	if time.Now().After(rt.ExpiresAt) {
		rt.Revoked = true
		database.DB.Save(&rt)
		clearRefreshTokenCookie(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token expired"})
		return
	}

	// Get user
	var user models.User
	if err := database.DB.First(&user, rt.UserID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	// Rotate token
	accessToken, err := issueAccessToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	newRefreshToken, err := issueRefreshToken(user.ID, rt.FamilyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	// Mark current token as used
	rt.Used = true
	if err := database.DB.Save(&rt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update token status"})
		return
	}

	setRefreshTokenCookie(c, newRefreshToken)

	c.JSON(http.StatusOK, gin.H{
		"token": accessToken,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"avatar":   user.Avatar,
		},
	})
}

func LogoutHandler(c *gin.Context) {
	cookieToken, err := c.Cookie("refresh-token")
	if err == nil && cookieToken != "" {
		database.DB.Model(&models.RefreshToken{}).
			Where("token = ?", cookieToken).
			Update("revoked", true)
	}

	clearRefreshTokenCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}
