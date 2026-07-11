export interface Conversation {
  id: string; request_id: string; request_title: string;
  other_user: { id: string; name: string; avatar_url: string | null };
  last_message: { preview: string; at: string | null } | null;
  unread_count: number; created_at: string;
}
export interface Message {
  id: string; sender_id: string; sender_name: string;
  type: string; content: string; attachment_url: string | null;
  read_at: string | null; created_at: string;
}
