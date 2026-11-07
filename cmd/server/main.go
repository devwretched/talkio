package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/hearth-platform/hearth/internal/database"
	"github.com/hearth-platform/hearth/internal/handlers"
	"github.com/hearth-platform/hearth/internal/middleware"
	"github.com/hearth-platform/hearth/internal/websocket"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	if err := middleware.InitJWT(); err != nil {
		log.Fatal("JWT Secret configuration failed: ", err)
	}

	if err := database.Connect(
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_SSL_MODE"),
	); err != nil {
		log.Fatal("Database connection failed:", err)
	}

	if err := database.Migrate(); err != nil {
		log.Fatal("Migration failed: ", err)
	}

	handlers.ChatHub = websocket.NewHub()
	go handlers.ChatHub.Run()

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	if err := r.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
		log.Fatal("Failed to set trusted proxies:", err)
	}

	// CORS Middleware
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			allowedOrigin := strings.TrimRight(strings.TrimSpace(os.Getenv("APP_ORIGIN")), "/")
			return origin == "" ||
				(allowedOrigin != "" && origin == allowedOrigin) ||
				strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:") ||
				strings.HasPrefix(origin, "https://localhost:") ||
				strings.HasPrefix(origin, "https://127.0.0.1:")
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Public routes
	r.POST("/api/auth/google", handlers.GoogleLogin)
	r.POST("/api/auth/register", handlers.RegisterHandler)
	r.POST("/api/auth/login", handlers.LoginHandler)
	r.POST("/api/auth/refresh", handlers.RefreshTokenHandler)
	r.POST("/api/auth/logout", handlers.LogoutHandler)

	// Protected routes
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.GET("/me", handlers.GetMe)
		protected.PUT("/me/profile", handlers.UpdateProfile)
		// Forum
		protected.POST("/threads", handlers.CreateThread)
		protected.GET("/threads", handlers.GetThreads)
		protected.GET("/threads/:id", handlers.GetThread)
		protected.POST("/threads/:id/posts", handlers.CreatePost)

		// Thread Reactions
		protected.POST("/threads/:id/reactions", handlers.AddThreadReactions)
		protected.DELETE("/threads/:id/reactions/:emoji", handlers.RemoveThreadReaction)
		protected.GET("/threads/:id/reactions", handlers.GetThreadReactions)

		// Chat
		protected.POST("/chatrooms", handlers.CreateChatroom)
		protected.GET("/chatrooms", handlers.GetChatrooms)
		protected.GET("/chatrooms/:id/history", handlers.GetChatHistory)
		protected.GET("/chatrooms/:id/ws", handlers.HandleChatWebsocket)

		// Upload
		protected.POST("/upload/avatar", handlers.UploadAvatar)
		protected.POST("/upload/image", handlers.UploadThreadImage)

		// Custom Emojis
		protected.POST("/emojis", handlers.CreateCustomEmoji)
		protected.GET("/emojis", handlers.GetCustomEmojis)
		protected.DELETE("/emojis/:id", handlers.DeleteCustomEmoji)

		// Admin invites (invite-only community)
		protected.POST("/invites", handlers.CreateInvite)
		protected.GET("/invites", handlers.ListInvites)
		protected.DELETE("/invites/:id", handlers.DeleteInvite)
	}

	// Serve static files
	r.Static("/uploads", "./uploads")
	r.Static("/reports", "./reports/public")

	port := os.Getenv("PORT")
	if port == "" {
		port = "5070"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	log.Printf("Starting server on port: %s", port)
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %s", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}
