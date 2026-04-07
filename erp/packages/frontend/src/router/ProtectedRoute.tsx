import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, user must have this permission */
  module?: string;
  resource?: string;
  action?: string;
  /** If provided, this module must be enabled for the company */
  requireModule?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  module,
  resource,
  action,
  requireModule,
}) => {
  const location = useLocation();
  const { isAuthenticated, hasPermission, isModuleEnabled } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireModule && !isModuleEnabled(requireModule)) {
    return <Navigate to="/403" state={{ reason: 'module-disabled' }} replace />;
  }

  if (module && resource && action && !hasPermission(module, resource, action)) {
    return <Navigate to="/403" state={{ reason: 'permission-denied' }} replace />;
  }

  return <>{children}</>;
};
