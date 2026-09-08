import api from './axios';
import { ApiResponse, Conversation, Message, IntelligenceResponse } from '../types';

export const chatApi = {
  createConversation: (title?: string) =>
    api.post<ApiResponse<{ conversation: Conversation }>>('/chat/conversations', { title }),

  getConversations: () =>
    api.get<ApiResponse<{ conversations: Conversation[] }>>('/chat/conversations'),

  getConversationMessages: (id: string) =>
    api.get<ApiResponse<{ conversation: Conversation; messages: Message[] }>>(`/chat/conversations/${id}`),

  sendMessage: (conversationId: string, content: string) =>
    api.post<ApiResponse<{ message: Message; intelligence: IntelligenceResponse }>>('/chat/message', {
      conversationId,
      content,
    }),

  deleteConversation: (id: string) =>
    api.delete<ApiResponse>(`/chat/conversations/${id}`),
};
