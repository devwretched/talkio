export type ApiError = {
  message: string;
  code?: string;
  status?: number;
};

export type User = {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  name?: string;
  bio?: string;
  created_at?: string;
};

export type AuthResponse = { token: string; user: User };

export type Thread = {
  id: number;
  title: string;
  user_id: number;
  user: User;
  posts: Post[];
  images: ThreadImage[];
  reactions: ThreadReaction[];
  created_at: string;
};

export type Post = {
  id: number;
  content: string;
  thread_id: number;
  user_id: number;
  user: User;
  created_at: string;
};

export type ThreadImage = {
  id: number;
  thread_id: number;
  url: string;
  caption?: string;
};

export type ThreadReaction = {
  id: number;
  thread_id: number;
  user_id: number;
  user: User;
  emoji: string;
  created_at: string;
};

export type Chatroom = {
  id: number;
  name: string;
  description?: string;
  created_by: number;
  created_at: string;
  active_users?: number;
};

export type MessageReaction = {
  id: number;
  message_id: number;
  user_id: number;
  user: User;
  emoji: string;
  created_at: string;
};

export type ChatMessage = {
  id: number;
  chatroom_id: number;
  user_id: number;
  user: User;
  content: string;
  created_at: string;
  reactions?: MessageReaction[];
};

export const REACTIONS = ["❤️", "🔥", "😂", "👍", "🎉", "😮"] as const;
