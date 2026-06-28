import React, { useEffect, useState } from 'react';
import {
  Users, UserCheck, UserX, Clock, Wifi,
  Server, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { DashboardStats } from '../../types';

interface ServerHealth {
  status: string;
  server_host: string;
  server_name: string;
  connected_peers: number;
  total_peers: number;
  uptime_seconds: number;
  memory_percent: number;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/admin/stats'),
      api.get<ServerHealth>('/admin/health'),
    ]).then(([s, h]) => {
      setStats(s);
      setHealth(h);
    }).finally(() => setLoading(false));

    const interval = setInterval(async () => {
      const [s, h] = await Promise.all([
        api.get<DashboardStats>('/admin/stats'),
        api.get<ServerHealth>('/admin/health'),
      ]);
      setStats(s);
      setHealth(h);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading dashboard...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Overview of your VPN platform</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard icon={<Users className="w-5 h-5 text-brand-400" />} label="Total Users" value={stats?.total_users ?? 0} />
          <StatCard icon={<UserCheck className="w-5 h-5 text-emerald-400" />} label="Active" value={stats?.active_users ?? 0} color="emerald" />
          <StatCard icon={<Wifi className="w-5 h-5 text-green-400" />} label="Online Now" value={stats?.online_users ?? 0} color="green" />
          <StatCard icon={<UserX className="w-5 h-5 text-red-400" />} label="Expired" value={stats?.expired_users ?? 0} color="red" />
          <StatCard icon={<AlertTriangle className="w-5 h-5 text-amber-400" />} label="Suspended" value={stats?.suspended_users ?? 0} color="amber" />
          <StatCard icon={<Clock className="w-5 h-5 text-orange-400" />} label="Expiring Soon" value={stats?.expiring_soon ?? 0} color="orange" />
        </div>

        {/* Server health */}
        <Card title="Server Health">
          {health ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HealthItem
                label="Status"
                value={health.status}
                color={health.status === 'online' ? 'text-emerald-400' : 'text-red-400'}
                icon={<Server className="w-4 h-4" />}
              />
              <HealthItem
                label="Server"
                value={`${health.server_name} (${health.server_host})`}
                color="text-slate-200"
                icon={<Server className="w-4 h-4" />}
              />
              <HealthItem
                label="Connected Peers"
                value={`${health.connected_peers} / ${health.total_peers}`}
                color="text-brand-400"
                icon={<Wifi className="w-4 h-4" />}
              />
              <HealthItem
                label="Memory Usage"
                value={`${health.memory_percent}%`}
                color={health.memory_percent > 80 ? 'text-red-400' : 'text-slate-200'}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <HealthItem
                label="API Uptime"
                value={formatUptime(health.uptime_seconds)}
                color="text-slate-200"
                icon={<Clock className="w-4 h-4" />}
              />
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Unable to reach server</p>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  icon, label, value, color = 'brand',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-slate-400 text-xs mt-1">{label}</p>
    </div>
  );
}

function HealthItem({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs">
        {icon}
        {label}
      </div>
      <p className={`text-sm font-medium ${color}`}>{value}</p>
    </div>
  );
}
