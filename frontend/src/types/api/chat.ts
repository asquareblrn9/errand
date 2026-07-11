import type { CursorParams, PaginationParams, Timestamps } from "./common";

// ── Conversation ───────────────────────────────────────────

export interface Conversation {
  id: string;
  request_id: string;
  request_title: string;
  other_user: ConversationUser;
  last_message: LastMessagePreview | null;
  unread_count: number;
  created_at: string;
}

export interface ConversationUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface LastMessagePreview {
  preview: string;
  at: string | null;
}

// ── Message ────────────────────────────────────────────────

export type MessageType = "text" | "image" | "location";

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  type: MessageType;
  content: string;
  attachment_url: string | null;
  read_at: string | null;
  created_at: string;
}

// ── Send Message ───────────────────────────────────────────

export interface SendMessageRequest {
  type?: MessageType;
  content?: string;
}

export interface MessagesQueryParams extends CursorParams {}
