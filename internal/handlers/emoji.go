package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hearth-platform/hearth/internal/database"
	"github.com/hearth-platform/hearth/internal/models"
)

const (
	MaxEmojiSize = 1 * 1024 * 1024
)

var (
	adminIDsCache  map[uint]bool
	adminCacheOnce sync.Once
)

func parseAdmins() {
	adminIDsCache = make(map[uint]bool)
	adminIDs := strings.Split(os.Getenv("ADMIN_USER_IDS"), ",")
	for _, rawID := range adminIDs {
		trimmed := strings.TrimSpace(rawID)
		if trimmed == "" {
			continue
		}
		parsedID, err := strconv.ParseUint(trimmed, 10, 64)
		if err == nil {
			adminIDsCache[uint(parsedID)] = true
		}
	}
}

func isAdmin(userID uint) bool {
	adminCacheOnce.Do(parseAdmins)
	return adminIDsCache[userID]
}

func CreateCustomEmoji(c *gin.Context) {
	userID := c.GetUint("user_id")

	if !isAdmin(userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	name := c.PostForm("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Emoji name required"})
		return
	}

	name = strings.ToLower(name)
	if !isValidEmojiName(name) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid emoji name (use lowercase letters, numbers, underscores)"})
		return
	}

	var existing models.CustomEmoji
	if err := database.DB.Where("name = ?", name).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Emoji name already exists"})
		return
	}

	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	if file.Size > MaxEmojiSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 1MB)"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process upload"})
		return
	}
	defer src.Close()

	buffer := make([]byte, 512)
	if _, err := src.Read(buffer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	contentType := http.DetectContentType(buffer)
	if contentType != "image/png" && contentType != "image/gif" && contentType != "image/webp" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type (png, gif, webp only)"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".png" && ext != ".gif" && ext != ".webp" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type (png, gif, webp only)"})
		return
	}

	filename := fmt.Sprintf("%s_%s%s", name, uuid.New().String()[:8], ext)
	filePath := filepath.Join(UploadPath, "emojis", filename)

	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	emojiURL := fmt.Sprintf("/uploads/emojis/%s", filename)
	customEmoji := models.CustomEmoji{
		Name:      name,
		URL:       emojiURL,
		CreatedBy: userID,
	}

	if err := database.DB.Create(&customEmoji).Error; err != nil {
		os.Remove(filePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create emoji"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Custom emoji created successfully",
		"emoji":   customEmoji,
	})
}

func GetCustomEmojis(c *gin.Context) {
	var emojis []models.CustomEmoji

	if err := database.DB.Order("created_at DESC").Find(&emojis).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch emojis"})
		return
	}

	c.JSON(http.StatusOK, emojis)
}

func DeleteCustomEmoji(c *gin.Context) {
	userID := c.GetUint("user_id")

	if !isAdmin(userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	emojiID := c.Param("id")

	var emoji models.CustomEmoji
	if err := database.DB.First(&emoji, emojiID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Emoji not found"})
		return
	}

	filePath := "." + emoji.URL
	os.Remove(filePath)

	if err := database.DB.Delete(&emoji).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete emoji"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Emoji deleted successfully",
	})
}

func isValidEmojiName(name string) bool {
	if len(name) < 2 || len(name) > 30 {
		return false
	}

	for _, char := range name {
		if !((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char == '_') {
			return false
		}
	}

	return true
}
