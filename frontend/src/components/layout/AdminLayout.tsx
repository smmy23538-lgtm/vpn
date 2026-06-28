import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, Activity, ScrollText,
  Server, LogOut, Menu, Globe, BarChart3, Bell, Settings, X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/client';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview',    end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/servers', icon: Server, label: 'Servers' },
  { to: '/admin/countries', icon: Globe, label: 'Countries' },
  { to: '/admin/connected', icon: Activity, label: 'Live' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/audit', icon: ScrollText, label: 'Audit Logs' },
  { to: '/admin/notifications', icon: Bell, label: 'Notifications' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api.get<{ count: number }>('/notifications/count')
      .then((d) => setUnread(d.count))
      .catch(() => {});
    const t = setInterval(() => {
      api.get<{ count: number }>('/notifications/count').then((d) => setUnread(d.count)).catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const Sidebar = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-slate-100 font-bold text-sm">SecureVPN</p>
          <p className="text-slate-500 text-xs">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition group
               ${isActive
                 ? 'bg-brand-600/15 text-brand-400 border border-brand-700/30'
                 : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span>{label}</span>
                {label === 'Notifications' && unread > 0 && (
                  <span className="ml-auto bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-4 border-t border-slate-800">
        <div className="px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-600/40 flex items-center justify-center mb-1.5">
            <span className="text-brand-400 text-sm font-bold">
              {user?.full_name?.[0]?.toUpperCase() ?? 'A'}
            </span>
          </div>
          <p className="text-slate-200 text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-slate-500 text-xs truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                     text-slate-400 hover:text-red-400 hover:bg-red-900/10 transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0">{Sidebar}</aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-56">{Sidebar}</div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 left-60 text-slate-400 hover:text-slate-200 z-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-slate-200">
            <Menu className="w-5 h-5" />
          </button>
          <Shield className="w-5 h-5 text-brand-500" />
          <span className="text-slate-100 font-bold text-sm">SecureVPN Admin</span>
          {unread > 0 && (
            <span className="ml-auto bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
              {unread}
            </span>
          )}
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
