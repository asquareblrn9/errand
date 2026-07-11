import api from './api';
import type { ApiResponse } from '../types/api';
import type { Conversation, Message } from '../types/chat';

export const chatService = {
  conversations: () => api.get<ApiResponse<Conversation[]>>('/conversations'),
  messages: (convoId: string) => api.get<ApiResponse<Message[]>>(`/conversations/${convoId}/messages?limit=50`),
  send: (convoId: string, content: string, type = 'text') => api.post(`/conversations/${convoId}/messages`, { content, type }),
  markRead: (convoId: string) => api.post(`/conversations/${convoId}/read`),
};
