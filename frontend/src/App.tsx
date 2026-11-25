import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';

// Supplier Pages
import { MyWorkOrdersPage } from './pages/supplier/MyWorkOrdersPage';
import { SupplierReportsPage } from './pages/supplier/SupplierReportsPage';

// Admin Pages
import { SupplierCredentialsPage } from './pages/admin/SupplierCredentialsPage';
import { StatusMonitoringPage } from './pages/admin/StatusMonitoringPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';

// Root redirect component
const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin/suppliers" replace />;
  }
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return <Navigate to="/supplier/work-orders" replace />;
};

const NotFound: React.FC = () => (
  <div style={{ padding: '3rem', textAlign: 'center' }}>
    <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#1e293b' }}>Page Not Found</h2>
    <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>The page you are looking for does not exist.</p>
    <a href="/" style={{ color: '#0284c7', textDecoration: 'underline' }}>Return to Home</a>
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes wrapped in common Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Change Password */}
              <Route path="/change-password" element={<ChangePasswordPage />} />

              {/* Supplier screens */}
              <Route
                path="/supplier/work-orders"
                element={
                  <ProtectedRoute allowedRole="supplier">
                    <MyWorkOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/supplier/reports"
                element={
                  <ProtectedRoute allowedRole="supplier">
                    <SupplierReportsPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin screens */}
              <Route
                path="/admin/suppliers"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <SupplierCredentialsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/status"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <StatusMonitoringPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <AdminReportsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Root and Fallback */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
