package database

import (
	"fmt"
	"log"

	"github.com/hearth-platform/hearth/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect(host, user, password, dbname, port, sslMode string) error {
	if sslMode == "" {
		sslMode = "disable"
	}
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		host, user, password, dbname, port, sslMode)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to connect to the database: %w", err)
	}

	log.Println("Database connected successfully!")

	return nil
}

func Migrate() error {
	err := DB.AutoMigrate(
		&models.User{},
		&models.InviteCode{},
		&models.Thread{},
		&models.Post{},
		&models.Chatroom{},
		&models.ChatMessage{},
		&models.ThreadImage{},
		&models.ThreadReaction{},
		&models.MessageReaction{},
		&models.CustomEmoji{},
		&models.RefreshToken{},
	)

	if err != nil {
		return err
	}

	DB.Exec(`
	CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_reactions_unique 
		ON thread_reactions(thread_id, user_id, emoji)
	`)

	DB.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reactions_unique 
		ON message_reactions(message_id, user_id, emoji)
	`)

	return nil
}
