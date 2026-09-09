import api from './axios';
import { ApiResponse, Conversation, Document, Message, IntelligenceResponse } from '../types';

export const chatApi = {
  createConversation: (title?: string) =>
    api.post<ApiResponse<{ conversation: Conversation }>>('/chat/conversations', { title }),

  getConversations: () =>
    api.get<ApiResponse<{ conversations: Conversation[] }>>('/chat/conversations'),

  getConversationMessages: (id: string) =>
    api.get<ApiResponse<{ conversation: Conversation; messages: Message[] }>>(`/chat/conversations/${id}`),

  sendMessage: (conversationId: string, content: string, documentId?: string, analyzeDocument = false) =>
    api.post<ApiResponse<{ message: Message; intelligence?: IntelligenceResponse; document?: Document }>>('/chat/message', {
      conversationId,
      content,
      documentId,
      analyzeDocument,
    }),

  deleteConversation: (id: string) =>
    api.delete<ApiResponse>(`/chat/conversations/${id}`),
};
