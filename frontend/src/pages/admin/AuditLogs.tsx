import React, { useEffect, useState, useCallback } from 'react';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AuditLog, PaginatedData } from '../../types';
import { formatDistanceToNow } from 'date-fns';

const actionColor: Record<string, string> = {
  'auth.login': 'text-brand-400',
  'auth.password_changed': 'text-amber-400',
  'vpn.peer.created': 'text-emerald-400',
  'vpn.peer.deleted': 'text-red-400',
  'vpn.access.enabled': 'text-emerald-400',
  'vpn.access.disabled': 'text-amber-400',
  'admin.user.created': 'text-brand-400',
  'admin.user.deleted': 'text-red-400',
  'admin.user.suspended': 'text-amber-400',
  'admin.user.reactivated': 'text-emerald-400',
  'admin.user.renewed': 'text-brand-400',
  'system.subscription.expired': 'text-red-400',
  'system.subscription.expiring_soon': 'text-amber-400',
};

export function AuditLogs() {
  const [data, setData] = useState<PaginatedData<AuditLog> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<PaginatedData<AuditLog>>('/admin/audit-logs', { page, limit: 50 });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ScrollText className="w-6 h-6 text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Audit Logs</h1>
            {data && <p className="text-slate-400 text-sm">{data.total} entries</p>}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Time', 'Action', 'User', 'Actor', 'IP'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400">Loading...</td></tr>
                ) : data?.items.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400">No logs yet</td></tr>
                ) : data?.items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-700/20 transition">
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-mono ${actionColor[log.action] ?? 'text-slate-300'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">
                      {(log as AuditLog & { user_email?: string }).user_email ?? log.user_id?.slice(0, 8) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">
                      {(log as AuditLog & { actor_email?: string }).actor_email ?? log.actor_id?.slice(0, 8) ?? 'system'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                      {log.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <p className="text-slate-400 text-sm">Page {page} of {data.pages}</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 hover:bg-slate-700 transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button disabled={page === data.pages} onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 hover:bg-slate-700 transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
