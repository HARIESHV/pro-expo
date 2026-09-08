import api from './axios';
import { ApiResponse, Document } from '../types';

export const documentsApi = {
  getDocuments: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    api.get<ApiResponse<{ documents: Document[]; total: number; totalPages: number }>>('/documents', { params }),

  getDocument: (id: string) =>
    api.get<ApiResponse<{ document: Document }>>(`/documents/${id}`),

  uploadDocument: (formData: FormData) =>
    api.post<ApiResponse<{ document: Document }>>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteDocument: (id: string) =>
    api.delete<ApiResponse>(`/documents/${id}`),

  reprocessDocument: (id: string) =>
    api.post<ApiResponse>(`/documents/${id}/reprocess`),
};
