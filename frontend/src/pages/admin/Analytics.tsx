import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Users, Activity, Server, RefreshCw, Clock, ArrowDownUp } from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { AnalyticsSummary, BandwidthPoint, DashboardStats } from '../../types';

const PIE_COLORS: Record<string, string> = {
  active: '#10b981',
  expired: '#ef4444',
  suspended: '#f59e0b',
  pending: '#6366f1',
};

function fmtBytes(b: number): string {
  if (!b) return '0 B';
  const k = 1024;
  const s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
}

function StatTile({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-slate-400 text-xs">{label}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function Analytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [bandwidth, setBandwidth] = useState<BandwidthPoint[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, bw, ds] = await Promise.all([
        api.get<AnalyticsSummary>('/analytics/summary', { days: String(days) }),
        api.get<BandwidthPoint[]>('/analytics/bandwidth', { hours: String(days * 24) }),
        api.get<DashboardStats>('/admin/stats'),
      ]);
      setSummary(s); setBandwidth(bw); setStats(ds);
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const pieData = summary
    ? summary.status_breakdown.map((r) => ({ name: r.status, value: r.count })).filter((d) => d.value > 0)
    : [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>
            <p className="text-slate-400 text-sm">Platform usage and trends</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary tiles */}
        {loading && !summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-slate-800 border border-slate-700 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile icon={Users} label="Total Users" value={stats?.total_users ?? 0}
              sub={`${stats?.active_users ?? 0} active`} color="bg-brand-600" />
            <StatTile icon={Activity} label="Online Now" value={stats?.online_users ?? 0} color="bg-emerald-600" />
            <StatTile icon={Server} label="Servers" value={`${stats?.online_servers ?? 0}/${stats?.total_servers ?? 0}`}
              sub="online" color="bg-violet-600" />
            <StatTile icon={ArrowDownUp} label="Total Bandwidth"
              value={fmtBytes((summary?.total_bandwidth_rx ?? 0) + (summary?.total_bandwidth_tx ?? 0))}
              sub={`${summary?.total_connections ?? 0} connections`} color="bg-sky-600" />
          </div>
        )}

        {summary && (
          <>
            {/* Quick stat bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Avg Session', value: `${summary.avg_session_minutes}m`, icon: Clock },
                { label: 'New This Month', value: summary.new_users_this_month, icon: Users },
                { label: 'Expiring Soon', value: summary.expiring_this_week, icon: TrendingUp },
                { label: 'Top Server', value: summary.top_server ?? '—', icon: Server },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-slate-200 font-semibold text-sm truncate">{value}</p>
                    <p className="text-slate-500 text-xs">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Daily active users chart */}
            <Card title={`Daily Users — Last ${days} days`}>
              <div className="h-52 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[...summary.daily].reverse()} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                      labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                    <Area type="monotone" dataKey="active_users" name="Active" stroke="#0ea5e9" fill="url(#gActive)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="new_users" name="New" stroke="#10b981" fill="url(#gNew)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hourly connections */}
              <Card title="Connections by Hour">
                <div className="h-44 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.hourly_connections} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `${v}h`} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                        labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }}
                        formatter={(v) => [v, 'Connections']} labelFormatter={(v) => `${v}:00`}
                      />
                      <Bar dataKey="count" fill="#818cf8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* User status pie */}
              <Card title="User Status Breakdown">
                {pieData.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-slate-500 text-sm">No data</div>
                ) : (
                  <div className="h-44 mt-2 flex items-center gap-4">
                    <ResponsiveContainer width="60%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                          dataKey="value" stroke="none">
                          {pieData.map((d) => (
                            <Cell key={d.name} fill={PIE_COLORS[d.name] ?? '#6366f1'} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                          itemStyle={{ color: '#e2e8f0' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2 text-sm">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 capitalize"
                              style={{ background: PIE_COLORS[d.name] ?? '#6366f1' }} />
                            <span className="text-slate-400 capitalize">{d.name}</span>
                          </div>
                          <span className="text-slate-200 font-semibold">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Bandwidth snapshot history */}
            {bandwidth.length > 0 && (
              <Card title="Bandwidth History (snapshots)">
                <div className="h-48 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bandwidth} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => fmtBytes(v)} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                        labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }}
                        formatter={(v) => [fmtBytes(Number(v)), '']}
                      />
                      <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                      <Line type="monotone" dataKey="rx" name="Download" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="tx" name="Upload" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Daily connections bar chart */}
            <Card title="Daily Connections">
              <div className="h-44 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...summary.daily].reverse()} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                      labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }}
                      formatter={(v) => [v, 'Connections']}
                    />
                    <Bar dataKey="connections" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Connections" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
