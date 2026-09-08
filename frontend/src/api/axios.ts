import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// In development, use a relative base URL so all requests flow through the Vite
// dev-server proxy (configured in vite.config.ts → server.proxy['/api']).
// The proxy forwards /api/* → http://localhost:5005/api/*, handling CORS automatically.
// In production, set VITE_API_URL to the full backend URL (e.g. https://api.example.com/api).
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 min for AI responses
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach access token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (import.meta.env.DEV) {
      const hasAuth = !!token;
      console.debug(
        `[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url} | auth=${hasAuth}`
      );
      if (!hasAuth) {
        console.warn('[API] Request sent without Authorization header — token missing from localStorage');
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: auto-refresh on TOKEN_EXPIRED; redirect on other 401s
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (import.meta.env.DEV && status) {
      console.debug(`[API] Response ${status} for ${originalRequest.method?.toUpperCase()} ${originalRequest.url}`);
    }

    if (status === 401 && !originalRequest._retry) {
      // Attempt token refresh only when the backend explicitly signals TOKEN_EXPIRED
      if (code === 'TOKEN_EXPIRED') {
        originalRequest._retry = true;
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) throw new Error('No refresh token available');

          if (import.meta.env.DEV) {
            console.debug('[API] Token expired — attempting refresh');
          }

          const { data } = await axiosInstance.post('/auth/refresh', { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = data.data.tokens;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          if (originalRequest.headers) {
            (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
          }
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          if (import.meta.env.DEV) {
            console.warn('[API] Token refresh failed — clearing session and redirecting to login');
          }
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }

      // Any other 401 (invalid token, no token, user inactive) → clear session and redirect
      if (import.meta.env.DEV) {
        console.warn(`[API] 401 Unauthorized (code=${code || 'none'}) — clearing session`);
      }
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // Only redirect if we're not already on an auth page to avoid loops
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
