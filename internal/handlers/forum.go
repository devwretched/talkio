package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/microcosm-cc/bluemonday"
	"github.com/hearth-platform/hearth/internal/database"
	"github.com/hearth-platform/hearth/internal/models"
	"gorm.io/gorm"
)

func CreateThread(c *gin.Context) {
	var req struct {
		Title   string `json:"title" binding:"required,min=3,max=200"`
		Content string `json:"content"`
		Images  []struct {
			URL     string `json:"url" binding:"required"`
			Caption string `json:"caption"`
		} `json:"images"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	p := bluemonday.StrictPolicy()
	req.Title = p.Sanitize(req.Title)
	req.Content = p.Sanitize(req.Content)

	for i := range req.Images {
		req.Images[i].Caption = p.Sanitize(req.Images[i].Caption)
	}

	userID := c.GetUint("user_id")

	thread := models.Thread{
		Title:  req.Title,
		UserID: userID,
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Create the thread
		if err := tx.Create(&thread).Error; err != nil {
			return err // Returning an error triggers a rollback
		}
		// 2. Create the initial post (if content exists)
		if req.Content != "" {
			post := models.Post{
				Content:  req.Content,
				ThreadID: thread.ID,
				UserID:   userID,
			}
			if err := tx.Create(&post).Error; err != nil {
				return err
			}
		}
		// 3. Attach any images
		if len(req.Images) > 0 {
			images := make([]models.ThreadImage, 0, len(req.Images))
			for _, image := range req.Images {
				images = append(images, models.ThreadImage{
					ThreadID: thread.ID,
					URL:      image.URL,
					Caption:  image.Caption,
				})
			}
			if err := tx.Create(&images).Error; err != nil {
				return err
			}
		}
		// If everything passes, return nil to commit the transaction!
		return nil
	})
	// Handle the transaction result
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Thread and attachments."})
		return
	}

	database.DB.Preload("User").Preload("Posts").Preload("Images").First(&thread, thread.ID)
	c.JSON(http.StatusCreated, thread)
}

func GetThread(c *gin.Context) {
	threadID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid thread ID"})
		return
	}

	thread, err := database.FetchThreadByID(uint(threadID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Thread not found."})
		return
	}

	c.JSON(http.StatusOK, thread)
}

func GetThreads(c *gin.Context) {
	search := c.Query("search")

	if len(search) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query too long (max 100 characters)"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}

	threads, err := database.ListThreads(search, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch threads"})
		return
	}

	c.JSON(http.StatusOK, threads)
}

func CreatePost(c *gin.Context) {
	threadID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid thread id"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	p := bluemonday.StrictPolicy()
	req.Content = p.Sanitize(req.Content)

	var thread models.Thread

	if err := database.DB.First(&thread, threadID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Thread not Found"})
		return
	}

	userID := c.GetUint("user_id")

	post := models.Post{
		Content:  req.Content,
		ThreadID: uint(threadID),
		UserID:   userID,
	}

	if err := database.DB.Create(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Post."})
		return
	}

	database.DB.Preload("User").First(&post, post.ID)

	c.JSON(http.StatusCreated, post)
}
