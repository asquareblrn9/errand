import apiClient, { extractData, toQueryParams } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  Conversation,
  ChatMessage,
  SendMessageRequest,
  MessagesQueryParams,
} from "@/types/api/chat";

// ── Chat ───────────────────────────────────────────────────

export const chatApi = {
  getConversations: () =>
    apiClient.get<ApiResponse<Conversation[]>>("/conversations").then(extractData),

  getMessages: (conversationId: string, params?: MessagesQueryParams) =>
    apiClient
      .get<ApiResponse<ChatMessage[]>>(
        `/conversations/${conversationId}/messages${toQueryParams(params ?? {})}`,
      )
      .then(extractData),

  sendMessage: (conversationId: string, payload: SendMessageRequest) =>
    apiClient.post(`/conversations/${conversationId}/messages`, payload),

  markRead: (conversationId: string) =>
    apiClient.post(`/conversations/${conversationId}/read`),
};
