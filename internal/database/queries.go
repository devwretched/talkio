package database

import (
	"github.com/hearth-platform/hearth/internal/models"
	"gorm.io/gorm"
)

func FetchThreadByID(threadID uint) (*models.Thread, error) {
	var thread models.Thread

	if err := DB.
		Preload("User").
		Preload("Posts", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Preload("Posts.User").
		Preload("Images").
		Preload("Reactions", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Preload("Reactions.User").
		First(&thread, threadID).Error; err != nil {
		return nil, err
	}

	return &thread, nil
}

func ListThreads(search string, page int, limit int) ([]models.Thread, error) {
	var threads []models.Thread

	query := DB.
		Preload("User").
		Preload("Posts").
		Preload("Posts.User").
		Preload("Images").
		Preload("Reactions").
		Preload("Reactions.User").
		Order("created_at DESC")

	if search != "" {
		query = query.Where("title ILIKE ?", "%"+search+"%")
	}

	offset := (page - 1) * limit
	query = query.Limit(limit).Offset(offset)

	if err := query.Find(&threads).Error; err != nil {
		return nil, err
	}

	return threads, nil
}

