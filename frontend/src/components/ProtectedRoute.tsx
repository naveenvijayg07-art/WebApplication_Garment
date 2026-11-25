import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If supplier must change password and is trying to access anything other than /change-password
  if (
    user.role === 'supplier' &&
    user.mustChangePassword &&
    location.pathname !== '/change-password'
  ) {
    return <Navigate to="/change-password" replace />;
  }

  // If route is restricted to a specific role and current user has different role
  if (allowedRole && user.role !== allowedRole) {
    const homePath = user.role === 'admin' ? '/admin/suppliers' : '/supplier/work-orders';
    return <Navigate to={homePath} replace />;
  }

  return <>{children}</>;
};
