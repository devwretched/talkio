package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hearth-platform/hearth/internal/database"
	"github.com/hearth-platform/hearth/internal/models"
)

const (
	MaxAvatarSize = 6 * 1024 * 1024
	MaxImageSize  = 10 * 1024 * 1024
	UploadPath    = "./uploads"
)

func init() {
	os.MkdirAll(filepath.Join(UploadPath, "avatars"), 0755)
	os.MkdirAll(filepath.Join(UploadPath, "images"), 0755)
	os.MkdirAll(filepath.Join(UploadPath, "emojis"), 0755)
}

func UploadAvatar(c *gin.Context) {
	userID := c.GetUint("user_id")

	file, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No File Uploaded"})
		return
	}

	if file.Size > MaxAvatarSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file size is too big"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process upload"})
		return
	}
	defer src.Close()

	//validation logic for file type checking
	buffer := make([]byte, 512)
	if _, err := src.Read(buffer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}

	contentType := http.DetectContentType(buffer)
	if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/gif" && contentType != "image/webp" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type (jpg, png, gif, webp only)"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))

	filename := fmt.Sprintf("%d_%s%s", userID, uuid.New().String(), ext)
	filePath := filepath.Join(UploadPath, "avatars", filename)

	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	avatarURL := fmt.Sprintf("/uploads/avatars/%s", filename)

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found."})
		return
	}

	if user.Avatar != "" {
		oldPath := "." + user.Avatar
		os.Remove(oldPath)
	}

	user.Avatar = avatarURL
	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update avatar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Avatar uploaded successfully!",
		"url":     avatarURL,
	})
}

func UploadThreadImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file uploaded"})
		return
	}

	if file.Size > MaxImageSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file size is too big"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process upload"})
		return
	}
	defer src.Close()

	//validation logic for file type checking
	buffer := make([]byte, 512)
	if _, err := src.Read(buffer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}

	contentType := http.DetectContentType(buffer)
	if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/gif" && contentType != "image/webp" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type (jpg, png, gif, webp only)"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))

	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), ext)
	filePath := filepath.Join(UploadPath, "images", filename)

	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	imageURL := fmt.Sprintf("/uploads/images/%s", filename)

	c.JSON(http.StatusOK, gin.H{
		"message": "Image uploaded successfully",
		"url":     imageURL,
	})
}
