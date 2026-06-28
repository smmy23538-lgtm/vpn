import React, { useEffect, useState, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Notification } from '../../types';
import { formatDistanceToNow } from 'date-fns';

const severityVariant: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  info: 'info', warning: 'warning', error: 'danger', success: 'success',
};

const severityLabel: Record<string, string> = {
  info: 'Info', warning: 'Warning', error: 'Error', success: 'Success',
};

type SeverityFilter = 'all' | 'info' | 'warning' | 'error' | 'success';
type ReadFilter = 'all' | 'unread' | 'read';

export function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (severityFilter !== 'all') params.severity = severityFilter;
    if (readFilter === 'unread') params.unread = 'true';
    if (readFilter === 'read') params.read = 'true';
    const data = await api.get<Notification[]>('/notifications', params);
    setItems(data); setSelected(new Set());
    setLoading(false);
  }, [severityFilter, readFilter]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((n) => n.id)));

  const markRead = async (ids?: string[]) => {
    setMarking(true);
    try {
      await api.post('/notifications/read', { ids: ids ?? Array.from(selected) });
      await load();
    } finally { setMarking(false); }
  };

  const markAllRead = async () => {
    setMarking(true);
    try {
      await api.post('/notifications/read', {});
      await load();
    } finally { setMarking(false); }
  };

  const purge = async () => {
    await api.delete('/notifications/purge');
    setPurgeConfirm(false); await load();
  };

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
            <p className="text-slate-400 text-sm">{unreadCount} unread · {items.length} total</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" icon={<CheckCheck className="w-4 h-4" />} loading={marking} onClick={markAllRead}>
                Mark all read
              </Button>
            )}
            <Button variant="danger" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => setPurgeConfirm(true)}>
              Purge old
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          {(['all', 'unread', 'read'] as ReadFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setReadFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition capitalize
                ${readFilter === f ? 'bg-brand-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
              {f}
            </button>
          ))}
          <span className="w-px h-4 bg-slate-700 mx-1" />
          {(['all', 'info', 'warning', 'error', 'success'] as SeverityFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setSeverityFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition capitalize
                ${severityFilter === f ? 'bg-brand-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
              {f === 'all' ? 'All severity' : f}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-900/30 border border-brand-700/40 rounded-lg text-sm">
            <span className="text-brand-300">{selected.size} selected</span>
            <Button size="sm" icon={<Check className="w-3.5 h-3.5" />} loading={marking} onClick={() => markRead()}>
              Mark read
            </Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-slate-400 hover:text-slate-200 text-xs">Clear</button>
          </div>
        )}

        {loading ? (
          <div className="text-slate-400 text-center py-12">Loading...</div>
        ) : items.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No notifications match your filters.</p>
            </div>
          </Card>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700 bg-slate-800/70">
              <input
                type="checkbox"
                checked={selected.size === items.length && items.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 accent-brand-500"
              />
              <span className="text-xs text-slate-500 font-medium">SELECT ALL</span>
            </div>
            <div className="divide-y divide-slate-700/50">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3.5 hover:bg-slate-700/30 transition cursor-pointer
                    ${!n.is_read ? 'bg-slate-750' : ''}`}
                  onClick={() => toggle(n.id)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-900 accent-brand-500 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { e.stopPropagation(); toggle(n.id); }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge label={severityLabel[n.severity] ?? n.severity} variant={severityVariant[n.severity] ?? 'info'} />
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />}
                      <span className="text-slate-200 text-sm font-medium truncate">{n.title}</span>
                    </div>
                    <p className="text-slate-400 text-sm">{n.message}</p>
                    <p className="text-slate-600 text-xs mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead([n.id]); }}
                      className="ml-2 p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-emerald-400 transition flex-shrink-0"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purge confirm */}
        <Modal open={purgeConfirm} onClose={() => setPurgeConfirm(false)} title="Purge Old Notifications" size="sm">
          <p className="text-slate-300 text-sm mb-4">
            This will permanently delete all notifications older than 30 days.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setPurgeConfirm(false)}>Cancel</Button>
            <Button variant="danger" className="flex-1 justify-center" onClick={purge}>Purge</Button>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
