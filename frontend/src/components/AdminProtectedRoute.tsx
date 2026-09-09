import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { isAdminRole } from '../types';

export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!isAdminRole(user.roles)) {
    return <div className="max-w-6xl mx-auto p-8"><h1 className="text-2xl font-bold">403 — Admin Access Required</h1><p className="text-muted-foreground">You need admin role to view this page.</p></div>;
  }
  return <>{children}</>;
}
