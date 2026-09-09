import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../api/auth';
import { computePermissions, Permission } from './rbac';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; organizationId: string }) => Promise<void>;
  setAuth: (user: User, tokens: { accessToken: string; refreshToken: string }) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function ensurePermissions(u: User): User {
  if (!u.permissions || !Array.isArray(u.permissions) || u.permissions.length === 0) {
    return { ...u, permissions: computePermissions(u.roles || []) };
  }
  return u;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authApi.me()
        .then((res) => {
          const raw = res.data.data?.user;
          if (raw) setUser(ensurePermissions(raw));
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { user: u, tokens } = res.data.data!;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    const authed = ensurePermissions(u);
    setUser(authed);
    return authed;
  };

  const register = async (data: Parameters<typeof authApi.register>[0]) => {
    const res = await authApi.register(data);
    const payload = res.data?.data;
    if (!payload?.user || !payload?.tokens) {
      throw new Error('Unexpected response from server');
    }
    localStorage.setItem('accessToken', payload.tokens.accessToken);
    localStorage.setItem('refreshToken', payload.tokens.refreshToken);
    setUser(ensurePermissions(payload.user));
  };

  const setAuth = (u: User, tokens: { accessToken: string; refreshToken: string }) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(ensurePermissions(u));
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken') || '';
    await authApi.logout(refreshToken).catch(() => {});
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
