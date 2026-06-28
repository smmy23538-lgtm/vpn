import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Shield, Home, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: Home, label: 'VPN' },
    { to: '/account', icon: User, label: 'Account' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-500" />
          <span className="text-slate-100 font-bold text-lg tracking-tight">SecureVPN</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm hidden sm:block">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-slate-200 transition p-2 rounded-lg hover:bg-slate-800"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">{children}</main>

      {/* Bottom navigation (mobile-first like native app) */}
      <nav className="bg-slate-900 border-t border-slate-800 safe-bottom">
        <div className="flex">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition
                 ${isActive ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'}`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
