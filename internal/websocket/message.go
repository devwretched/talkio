package websocket

import (
	"encoding/json"

	"github.com/hearth-platform/hearth/internal/models"
)

const (
	MessageTypeChat     = "chat"
	MessageTypeSendChat = "send_message"
	MessageTypeJoin     = "join"
	MessageTypeLeave    = "leave"
	MessageTypeTyping   = "typing"
	EventTypeNewMessage = "new_message"
	EventTypeUserJoined = "user_joined"
	EventTypeUserLeft   = "user_left"
)

type IncomingMessage struct {
	Type      string          `json:"type"`
	RoomID    string          `json:"room_id,omitempty"`
	UserID    uint            `json:"user_id,omitempty"`
	Username  string          `json:"username,omitempty"`
	Content   string          `json:"content,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp int64           `json:"timestamp,omitempty"`
}

type Event struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type ChatMessage struct {
	Content string `json:"content"`
}

type TypingMessage struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
}

type OutgoingChatMessage struct {
	ID         uint                     `json:"id"`
	ChatroomID uint                     `json:"chatroom_id"`
	UserID     uint                     `json:"user_id"`
	User       models.User              `json:"user"`
	Content    string                   `json:"content"`
	CreatedAt  string                   `json:"created_at"`
	Reactions  []models.MessageReaction `json:"reactions,omitempty"`
}

func NewEvent(eventType string, payload any) ([]byte, error) {
	encodedPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	return json.Marshal(Event{
		Type:    eventType,
		Payload: encodedPayload,
	})
}
