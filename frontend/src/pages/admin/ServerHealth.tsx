import React, { useEffect, useState } from 'react';
import { Server, Wifi, RefreshCw, CheckCircle2, AlertCircle, Clock, MemoryStick } from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

interface Health {
  status: string;
  server_host: string;
  server_name: string;
  connected_peers: number;
  total_peers: number;
  uptime_seconds: number;
  memory_percent: number;
  cpu_user: number;
  cpu_system: number;
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export function ServerHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetch = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get<Health>('/admin/health');
      setHealth(data);
      setLastUpdated(new Date());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetch();
    const interval = setInterval(() => fetch(true), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Server Health</h1>
            {lastUpdated && (
              <p className="text-slate-400 text-sm">Last updated: {lastUpdated.toLocaleTimeString()}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" loading={refreshing} icon={<RefreshCw className="w-4 h-4" />} onClick={() => fetch(true)}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-slate-400">Checking server status...</div>
        ) : !health ? (
          <Card>
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <p className="font-medium">Server unreachable — check your wg-easy instance</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Status banner */}
            <div className={`rounded-xl p-4 border flex items-center gap-3
              ${health.status === 'online'
                ? 'bg-emerald-900/20 border-emerald-700/50'
                : 'bg-red-900/20 border-red-700/50'}`}
            >
              {health.status === 'online'
                ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                : <AlertCircle className="w-6 h-6 text-red-400" />}
              <div>
                <p className={`font-semibold ${health.status === 'online' ? 'text-emerald-300' : 'text-red-300'}`}>
                  VPN Server {health.status === 'online' ? 'Online' : 'Offline'}
                </p>
                <p className="text-slate-400 text-sm">{health.server_name} · {health.server_host}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="VPN Statistics">
                <div className="space-y-4">
                  <MetricRow icon={<Wifi className="w-4 h-4 text-emerald-400" />} label="Connected Peers" value={`${health.connected_peers}`} />
                  <MetricRow icon={<Server className="w-4 h-4 text-brand-400" />} label="Total Active Peers" value={`${health.total_peers}`} />
                  <MetricRow icon={<Clock className="w-4 h-4 text-slate-400" />} label="API Uptime" value={formatUptime(health.uptime_seconds)} />
                </div>
              </Card>

              <Card title="Resource Usage">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <MemoryStick className="w-4 h-4" />
                        Memory
                      </div>
                      <span className={`text-sm font-medium ${health.memory_percent > 80 ? 'text-red-400' : 'text-slate-200'}`}>
                        {health.memory_percent}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${health.memory_percent > 80 ? 'bg-red-500' : health.memory_percent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${health.memory_percent}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    CPU time — User: {(health.cpu_user / 1000).toFixed(1)}ms · System: {(health.cpu_system / 1000).toFixed(1)}ms
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function MetricRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-slate-400 text-sm">{icon}{label}</div>
      <span className="text-slate-200 font-medium text-sm">{value}</span>
    </div>
  );
}
