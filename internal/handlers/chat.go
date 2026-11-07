package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/microcosm-cc/bluemonday"
	"github.com/hearth-platform/hearth/internal/database"
	"github.com/hearth-platform/hearth/internal/models"
	ws "github.com/hearth-platform/hearth/internal/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return isAllowedWebsocketOrigin(origin)
	},
}

var ChatHub *ws.Hub

func isAllowedWebsocketOrigin(origin string) bool {

	allowedOrigin := strings.TrimRight(strings.TrimSpace(os.Getenv("APP_ORIGIN")), "/")
	if allowedOrigin != "" && origin == allowedOrigin {
		return true
	}

	parsedOrigin, err := url.Parse(origin)
	if err != nil {
		return false
	}

	host := parsedOrigin.Hostname()
	return host == "localhost" || host == "127.0.0.1"
}

func CreateChatroom(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required,min=3,max=100"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	userID := c.GetUint("user_id")

	chatroom := models.Chatroom{
		Name:        req.Name,
		Description: req.Description,
		CreatedBy:   userID,
	}

	if err := database.DB.Create(&chatroom).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create chatroom."})
		return
	}

	c.JSON(http.StatusCreated, chatroom)
}

func GetChatrooms(c *gin.Context) {
	var chatrooms []models.Chatroom

	if err := database.DB.Order("created_at DESC").Find(&chatrooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chatrooms."})
		return
	}

	type ChatroomWithCount struct {
		models.Chatroom
		ActiveUsers int `json:"active_users"`
	}

	result := make([]ChatroomWithCount, len(chatrooms))
	for i, room := range chatrooms {
		result[i] = ChatroomWithCount{
			Chatroom:    room,
			ActiveUsers: ChatHub.GetRoomClients(strconv.Itoa(int(room.ID))),
		}
	}

	c.JSON(http.StatusOK, result)
}

func GetChatHistory(c *gin.Context) {
	roomID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid RoomID"})
		return
	}

	// Parse query parameters with defaults
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50 // Cap max limit for safety
	}

	offset := (page - 1) * limit

	var messages []models.ChatMessage

	// Order by DESC to get the newest messages first
	if err := database.DB.Where("chatroom_id = ?", roomID).Preload("User").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chat messages."})
		return
	}

	// Reverse the slice in-memory so they display chronologically (oldest at top, newest at bottom)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	c.JSON(http.StatusOK, messages)
}

func HandleChatWebsocket(c *gin.Context) {
	roomID := c.Param("id")

	userID := c.GetUint("user_id")
	username := c.GetString("username")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Websocket upgrade failed: %v", err)
		return
	}

	client := &ws.Client{
		Hub:      ChatHub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		RoomID:   roomID,
		UserID:   userID,
		Username: username,
	}

	client.Hub.Register <- client

	go client.WritePump()
	go handleChatMessages(client)
}

func handleChatMessages(client *ws.Client) {
	defer func() {
		client.Hub.Unregister <- client
		client.Conn.Close()
	}()

	client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	client.Conn.SetReadLimit(512 * 1024)
	client.Conn.SetPongHandler(func(string) error {
		client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := client.Conn.ReadMessage()

		if err != nil {
			break
		}

		var msg ws.IncomingMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Invalid message format: %v", err)
			continue
		}

		switch msg.Type {
		case ws.MessageTypeChat, ws.MessageTypeSendChat:
			content := msg.Content
			if content == "" && len(msg.Payload) > 0 {
				var payload ws.ChatMessage
				if err := json.Unmarshal(msg.Payload, &payload); err == nil {
					content = payload.Content
				}
			}

			p := bluemonday.StrictPolicy()
			cleanContent := p.Sanitize(content)

			if cleanContent == "" {
				continue
			}

			roomID, _ := strconv.Atoi(client.RoomID)
			chatMessage := models.ChatMessage{
				ChatroomID: uint(roomID),
				UserID:     client.UserID,
				Content:    cleanContent,
			}

			if err := database.DB.Create(&chatMessage).Error; err != nil {
				log.Printf("Failed to save chat message: %v", err)
				continue
			}

			if err := database.DB.Preload("User").First(&chatMessage, chatMessage.ID).Error; err != nil {
				log.Printf("Failed to hydrate chat message: %v", err)
				continue
			}

			data, err := ws.NewEvent(ws.EventTypeNewMessage, ws.OutgoingChatMessage{
				ID:         chatMessage.ID,
				ChatroomID: chatMessage.ChatroomID,
				UserID:     chatMessage.UserID,
				User:       chatMessage.User,
				Content:    chatMessage.Content,
				CreatedAt:  chatMessage.CreatedAt.Format(time.RFC3339),
				Reactions:  chatMessage.Reactions,
			})
			if err != nil {
				continue
			}
			client.Hub.Broadcast <- &ws.BroadcastMessage{
				RoomID:  client.RoomID,
				Message: data,
			}
		case ws.MessageTypeTyping:
			data, err := ws.NewEvent(ws.MessageTypeTyping, ws.TypingMessage{
				UserID:   client.UserID,
				Username: client.Username,
			})
			if err != nil {
				continue
			}
			client.Hub.Broadcast <- &ws.BroadcastMessage{
				RoomID:  client.RoomID,
				Message: data,
			}
		}
	}
}
