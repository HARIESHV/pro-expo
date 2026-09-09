import api from './axios';
import { ApiResponse, User, AuthTokens } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ user: User; tokens: AuthTokens }>>('/auth/login', { email, password }),

  sendOtp: (email: string) =>
    api.post<ApiResponse<{ email: string }>>('/auth/send-otp', { email }),

  verifyOtp: (email: string, otp: string) =>
    api.post<ApiResponse<{ user: User; tokens: AuthTokens; isNewUser: boolean }>>('/auth/verify-otp', { email, otp }),

  register: (data: { email: string; password: string; firstName: string; lastName: string; organizationId?: string }) =>
    api.post<ApiResponse<{ user: User; tokens: AuthTokens }>>('/auth/register', data),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ tokens: AuthTokens }>>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    api.post<ApiResponse>('/auth/logout', { refreshToken }),

  me: () =>
    api.get<ApiResponse<{ user: User }>>('/auth/me'),
}