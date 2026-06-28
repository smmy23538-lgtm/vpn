import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import { Login } from './pages/Login';
import { Dashboard } from './pages/customer/Dashboard';
import { Account } from './pages/customer/Account';
import { Settings } from './pages/customer/Settings';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { Users } from './pages/admin/Users';
import { UserDetail } from './pages/admin/UserDetail';
import { CreateUser } from './pages/admin/CreateUser';
import { ConnectedUsers } from './pages/admin/ConnectedUsers';
import { AuditLogs } from './pages/admin/AuditLogs';
import { ServerHealth } from './pages/admin/ServerHealth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400">Loading...</div>
    </div>
  );
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated
          ? <Navigate to={isAdmin ? '/admin' : '/'} replace />
          : <Login />
      } />

      {/* Customer routes */}
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />

      {/* Admin routes */}
      <Route path="/admin" element={<RequireAuth><RequireAdmin><AdminDashboard /></RequireAdmin></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth><RequireAdmin><Users /></RequireAdmin></RequireAuth>} />
      <Route path="/admin/users/new" element={<RequireAuth><RequireAdmin><CreateUser /></RequireAdmin></RequireAuth>} />
      <Route path="/admin/users/:id" element={<RequireAuth><RequireAdmin><UserDetail /></RequireAdmin></RequireAuth>} />
      <Route path="/admin/connected" element={<RequireAuth><RequireAdmin><ConnectedUsers /></RequireAdmin></RequireAuth>} />
      <Route path="/admin/audit" element={<RequireAuth><RequireAdmin><AuditLogs /></RequireAdmin></RequireAuth>} />
      <Route path="/admin/health" element={<RequireAuth><RequireAdmin><ServerHealth /></RequireAdmin></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
