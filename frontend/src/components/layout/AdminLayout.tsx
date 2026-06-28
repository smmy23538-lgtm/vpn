import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, Activity,
  ScrollText, Server, LogOut, Menu, X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/connected', icon: Activity, label: 'Connected' },
  { to: '/admin/audit', icon: ScrollText, label: 'Audit Logs' },
  { to: '/admin/health', icon: Server, label: 'Server Health' },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const Sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700">
        <Shield className="w-7 h-7 text-brand-500" />
        <div>
          <p className="text-slate-100 font-bold">SecureVPN</p>
          <p className="text-xs text-slate-400">Admin Panel</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
               ${isActive
                 ? 'bg-brand-600/20 text-brand-400 border border-brand-700/40'
                 : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="px-3 mb-3">
          <p className="text-xs text-slate-500">Logged in as</p>
          <p className="text-sm text-slate-300 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                     text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-slate-800 border-r border-slate-700 flex-shrink-0">
        {Sidebar}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-60 bg-slate-800 border-r border-slate-700">
            {Sidebar}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-slate-200">
            <Menu className="w-5 h-5" />
          </button>
          <Shield className="w-5 h-5 text-brand-500" />
          <span className="text-slate-100 font-bold">SecureVPN Admin</span>
        </div>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
