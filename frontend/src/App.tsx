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
import { Servers } from './pages/admin/Servers';
import { Countries } from './pages/admin/Countries';
import { Analytics } from './pages/admin/Analytics';
import { Notifications } from './pages/admin/Notifications';
import { Settings as AdminSettings } from './pages/admin/Settings';

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

const Admin = ({ el }: { el: React.ReactNode }) => (
  <RequireAuth><RequireAdmin>{el}</RequireAdmin></RequireAuth>
);

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
      <Route path="/admin" element={<Admin el={<AdminDashboard />} />} />
      <Route path="/admin/users" element={<Admin el={<Users />} />} />
      <Route path="/admin/users/new" element={<Admin el={<CreateUser />} />} />
      <Route path="/admin/users/:id" element={<Admin el={<UserDetail />} />} />
      <Route path="/admin/connected" element={<Admin el={<ConnectedUsers />} />} />
      <Route path="/admin/audit" element={<Admin el={<AuditLogs />} />} />
      <Route path="/admin/health" element={<Admin el={<ServerHealth />} />} />
      <Route path="/admin/servers" element={<Admin el={<Servers />} />} />
      <Route path="/admin/countries" element={<Admin el={<Countries />} />} />
      <Route path="/admin/analytics" element={<Admin el={<Analytics />} />} />
      <Route path="/admin/notifications" element={<Admin el={<Notifications />} />} />
      <Route path="/admin/settings" element={<Admin el={<AdminSettings />} />} />

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
