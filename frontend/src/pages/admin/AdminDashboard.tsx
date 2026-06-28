import React, { useEffect, useState } from 'react';
import {
  Users, UserCheck, UserX, Clock, Wifi, Server,
  TrendingUp, AlertTriangle, UserPlus, Globe, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { DashboardStats, Notification } from '../../types';
import { formatDistanceToNow } from 'date-fns';

const severityVariant: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  info: 'info', warning: 'warning', error: 'danger', success: 'success',
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/admin/stats'),
      api.get<Notification[]>('/notifications', { unread: 'true', limit: '5' }),
    ]).then(([s, n]) => { setStats(s); setNotifications(n); })
      .finally(() => setLoading(false));

    const interval = setInterval(async () => {
      const [s, n] = await Promise.all([
        api.get<DashboardStats>('/admin/stats'),
        api.get<Notification[]>('/notifications', { unread: 'true', limit: '5' }),
      ]);
      setStats(s); setNotifications(n);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = stats ? [
    { icon: Users, label: 'Total Users',     value: stats.total_users,        color: 'text-brand-400',   bg: 'bg-brand-900/20' },
    { icon: UserCheck, label: 'Active',      value: stats.active_users,       color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
    { icon: Wifi, label: 'Online Now',        value: stats.online_users,       color: 'text-green-400',   bg: 'bg-green-900/20' },
    { icon: UserX, label: 'Expired',          value: stats.expired_users,      color: 'text-red-400',     bg: 'bg-red-900/20' },
    { icon: AlertTriangle, label: 'Suspended',value: stats.suspended_users,    color: 'text-amber-400',   bg: 'bg-amber-900/20' },
    { icon: Clock, label: 'Expiring Soon',    value: stats.expiring_soon,      color: 'text-orange-400',  bg: 'bg-orange-900/20' },
    { icon: UserPlus, label: 'New This Month',value: stats.new_users_this_month,color: 'text-sky-400',    bg: 'bg-sky-900/20' },
    { icon: Server, label: 'Servers Online', value: `${stats.online_servers ?? 0}/${stats.total_servers ?? 0}`, color: 'text-violet-400', bg: 'bg-violet-900/20' },
  ] : [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
            <p className="text-slate-400 text-sm mt-0.5">Platform health at a glance</p>
          </div>
          <button
            onClick={() => navigate('/admin/users/new')}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <UserPlus className="w-4 h-4" />
            New User
          </button>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition">
                <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-2xl font-bold text-slate-100">{value}</p>
                <p className="text-slate-400 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notifications preview */}
          <Card
            title="Recent Alerts"
            action={
              <button onClick={() => navigate('/admin/notifications')} className="flex items-center gap-1 text-brand-400 hover:text-brand-300 text-xs transition">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            }
          >
            {notifications.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No new alerts</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3">
                    <Badge label={n.severity} variant={severityVariant[n.severity]} />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm font-medium truncate">{n.title}</p>
                      <p className="text-slate-500 text-xs">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick actions */}
          <Card title="Quick Actions">
            <div className="space-y-2">
              {[
                { label: 'Create new user', icon: UserPlus, to: '/admin/users/new', color: 'text-brand-400' },
                { label: 'View connected users', icon: Wifi, to: '/admin/connected', color: 'text-emerald-400' },
                { label: 'Add a VPN server', icon: Server, to: '/admin/servers', color: 'text-violet-400' },
                { label: 'Add a country', icon: Globe, to: '/admin/countries', color: 'text-sky-400' },
                { label: 'View analytics', icon: TrendingUp, to: '/admin/analytics', color: 'text-amber-400' },
              ].map(({ label, icon: Icon, to, color }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                             text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition text-left"
                >
                  <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                  {label}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 ml-auto" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
