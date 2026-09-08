import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AccessRestricted } from './AccessRestricted';
import { Permission } from '../auth/rbac';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission) {
    const hasPerm = user.permissions?.includes(requiredPermission);
    if (!hasPerm) {
      return (
        <div className="p-8 max-w-7xl mx-auto">
          <AccessRestricted
            resourceName={location.pathname.replace(/^\//, '').replace(/-/g, ' ')}
            requiredPermission={requiredPermission}
          />
        </div>
      );
    }
  }

  return <>{children}</>;
}
