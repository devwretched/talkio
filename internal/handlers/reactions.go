package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/hearth-platform/hearth/internal/database"
	"github.com/hearth-platform/hearth/internal/models"
	"gorm.io/gorm"
)

var validEmojis = map[string]bool{
	"❤️": true,
	"🔥":  true,
	"😂":  true,
	"👍":  true,
	"🎉":  true,
	"😮":  true,
}

// isValidEmoji accepts any short emoji-like payload (quick picks or custom
// picks from the picker). It only rejects empty strings, oversized payloads
// and anything carrying markup or control characters.
func isValidEmoji(s string) bool {
	if s == "" || len(s) > 24 {
		return false
	}
	for _, r := range s {
		if r < 0x20 || r == '<' || r == '>' || r == '/' || r == '\\' {
			return false
		}
	}
	return true
}

func AddThreadReactions(c *gin.Context) {
	threadID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid thread id"})
		return
	}

	var req struct {
		Emoji string `json:"emoji" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	if !isValidEmoji(req.Emoji) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid emoji type"})
		return
	}

	userID := c.GetUint("user_id")

	var thread models.Thread
	if err := database.DB.First(&thread, threadID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Thread not found"})
		return
	}

	var existing models.ThreadReaction
	result := database.DB.Where("thread_id = ? AND user_id = ? AND emoji = ?",
		threadID, userID, req.Emoji).Take(&existing)

	if result.Error == nil {
		database.DB.Preload("User").First(&existing, existing.ID)
		c.JSON(http.StatusOK, gin.H{
			"message":  "Reaction already exists",
			"reaction": existing,
		})
		return
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing reaction"})
		return
	}

	reaction := models.ThreadReaction{
		ThreadID: uint(threadID),
		UserID:   userID,
		Emoji:    req.Emoji,
	}

	if err := database.DB.Create(&reaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add reaction"})
		return
	}

	database.DB.Preload("User").First(&reaction, reaction.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Reaction added successfully",
		"reaction": reaction,
	})
}

func RemoveThreadReaction(c *gin.Context) {
	threadID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid thread ID"})
		return
	}

	emoji := c.Param("emoji")

	if !isValidEmoji(emoji) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid emoji type"})
		return
	}

	userID := c.GetUint("user_id")

	result := database.DB.Where("thread_id = ? AND user_id = ? AND emoji = ?",
		threadID, userID, emoji).Delete(&models.ThreadReaction{})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove reaction"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Reaction not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Reaction removed successfully",
	})
}

func GetThreadReactions(c *gin.Context) {
	threadID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid thread ID"})
		return
	}

	var reactions []models.ThreadReaction
	if err := database.DB.Where("thread_id = ?", threadID).
		Preload("User").
		Order("created_at ASC").
		Find(&reactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reactions"})
		return
	}

	emojiCounts := make(map[string]int)
	emojiUsers := make(map[string][]string)

	for _, reaction := range reactions {
		emojiCounts[reaction.Emoji]++
		emojiUsers[reaction.Emoji] = append(emojiUsers[reaction.Emoji], reaction.User.Username)
	}

	c.JSON(http.StatusOK, gin.H{
		"reactions":    reactions,
		"emoji_counts": emojiCounts,
		"emoji_users":  emojiUsers,
	})
}

func AddMessageReactionDB(messageID, userID uint, emoji string) (*models.MessageReaction, error) {
	if !isValidEmoji(emoji) {
		return nil, fmt.Errorf("invalid emoji type")
	}

	var existing models.MessageReaction
	result := database.DB.Where("message_id = ? AND user_id = ? AND emoji = ?",
		messageID, userID, emoji).First(&existing)

	if result.Error == nil {
		return &existing, nil
	}

	reaction := models.MessageReaction{
		MessageID: messageID,
		UserID:    userID,
		Emoji:     emoji,
	}

	if err := database.DB.Create(&reaction).Error; err != nil {
		return nil, err
	}

	database.DB.Preload("User").First(&reaction, reaction.ID)
	return &reaction, nil
}

func RemoveMessageReactionDB(messageID, userID uint, emoji string) error {
	result := database.DB.Where("message_id = ? AND user_id = ? AND emoji = ?",
		messageID, userID, emoji).Delete(&models.MessageReaction{})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("reaction not found")
	}

	return nil
}
