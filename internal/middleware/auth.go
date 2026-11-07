package middleware

import (
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

var jwtSecret []byte

func InitJWT() error {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return errors.New("JWT_SECRET environment variable is not configured")
	}
	jwtSecret = []byte(secret)
	return nil
}

func JWTSecret() []byte {
	return jwtSecret
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := normalizeToken(c.GetHeader("Authorization"))

		if token == "" {
			token = normalizeToken(c.Query("token"))
		}

		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
			c.Abort()
			return
		}

		secret := JWTSecret()

		parsedToken, err := jwt.ParseWithClaims(token, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			return secret, nil
		}, jwt.WithValidMethods([]string{"HS256"}))

		if err != nil || !parsedToken.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Token"})
			c.Abort()
			return
		}

		claims := parsedToken.Claims.(*Claims)
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Next()
	}
}

func normalizeToken(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Trim(value, "\"'")
	value = strings.TrimPrefix(value, "Bearer ")
	if value == "" {
		return ""
	}

	if decoded, err := url.QueryUnescape(value); err == nil && decoded != "" {
		value = decoded
	}

	// Some clients/transports convert `+` to spaces in query params.
	value = strings.ReplaceAll(value, " ", "+")
	return value
}
