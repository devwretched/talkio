"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { ChatMessage } from "@/types";

type IncomingEvent = { type: string; payload: unknown };

/** Live presence for one chatroom over the Go WS hub. */
export function useChatWebSocket(chatroomId: number, onMessage: (m: ChatMessage) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const generation = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const token = useAuth((s) => s.token);

  useEffect(() => {
    if (!chatroomId) return;
    const connectId = ++generation.current;

    const base = process.env.NEXT_PUBLIC_WS_URL || `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    // Backend auth middleware accepts `?token=` query auth for WebSocket upgrades.
    const url = token ? `${base}/api/chatrooms/${chatroomId}/ws?token=${encodeURIComponent(token)}` : `${base}/api/chatrooms/${chatroomId}/ws`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error("WebSocket error:", err);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (generation.current === connectId) setIsConnected(true);
    };
    ws.onmessage = (event) => {
      if (generation.current !== connectId) return;
      try {
        const evt: IncomingEvent = JSON.parse(event.data);
        switch (evt.type) {
          case "new_message":
            onMessageRef.current(evt.payload as ChatMessage);
            setTypingUsers((prev) => prev.filter((u) => (evt.payload as ChatMessage).user?.username !== u));
            break;
          case "typing": {
            const { username } = evt.payload as { user_id: number; username: string };
            if (username) {
              setTypingUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
              setTimeout(() => {
                setTypingUsers((prev) => prev.filter((u) => u !== username));
              }, 2500);
            }
            break;
          }
          case "user_left":
            setTypingUsers([]);
            break;
        }
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (generation.current === connectId) setIsConnected(false);
    };
    ws.onerror = () => {
      if (generation.current === connectId) setIsConnected(false);
    };

    return () => {
      generation.current++;
      ws.close(1000, "unmounting");
      setIsConnected(false);
      setTypingUsers([]);
    };
  }, [chatroomId, token]);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "send_message", payload: { content } }));
    }
  }, []);

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", payload: {} }));
    }
  }, []);

  return { isConnected, sendMessage, sendTyping, typingUsers };
}
