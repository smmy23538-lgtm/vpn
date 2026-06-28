import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

interface ConnectedUser {
  userId: string;
  email: string;
  vpn_ip: string;
  connected: boolean;
  transfer_rx: number;
  transfer_tx: number;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

export function ConnectedUsers() {
  const [users, setUsers] = useState<ConnectedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get<ConnectedUser[]>('/admin/connected');
      setUsers(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetch();
    const interval = setInterval(() => fetch(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const connected = users.filter((u) => u.connected);
  const disconnected = users.filter((u) => !u.connected);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Connected Users</h1>
            <p className="text-slate-400 text-sm">
              {connected.length} online · {disconnected.length} offline · updates every 15s
            </p>
          </div>
          <Button variant="secondary" size="sm" loading={refreshing} icon={<RefreshCw className="w-4 h-4" />} onClick={() => fetch(true)}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Status', 'User', 'VPN IP', 'Download', 'Upload'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400">No VPN peers configured</td></tr>
                ) : users.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-700/20 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {u.connected
                          ? <Wifi className="w-4 h-4 text-emerald-400" />
                          : <WifiOff className="w-4 h-4 text-slate-500" />}
                        <Badge label={u.connected ? 'Online' : 'Offline'} variant={u.connected ? 'success' : 'neutral'} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-200 text-sm">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm font-mono">{u.vpn_ip || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-300 text-sm">
                        <ArrowDown className="w-3.5 h-3.5 text-brand-400" />
                        {formatBytes(u.transfer_rx)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-300 text-sm">
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                        {formatBytes(u.transfer_tx)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
