import api from './axios';
import { ApiResponse, User, AuthTokens } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ user: User; tokens: AuthTokens }>>('/auth/login', { email, password }),

  register: (data: { email: string; password: string; firstName: string; lastName: string; organizationId?: string }) =>
    api.post<ApiResponse<{ user: User; tokens: AuthTokens }>>('/auth/register', data),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ tokens: AuthTokens }>>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    api.post<ApiResponse>('/auth/logout', { refreshToken }),

  me: () =>
    api.get<ApiResponse<{ user: User }>>('/auth/me'),
}