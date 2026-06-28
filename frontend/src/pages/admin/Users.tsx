import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, Plus, UserCheck, UserX, RotateCcw,
  Trash2, RefreshCw, ChevronLeft, ChevronRight, Eye,
} from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { User, PaginatedData, UserStatus } from '../../types';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface RenewModalState { open: boolean; userId: string; email: string; }
interface ConfirmModal { open: boolean; title: string; message: string; onConfirm: () => void; }

const statusVariant: Record<UserStatus, 'success' | 'danger' | 'warning'> = {
  active: 'success', expired: 'warning', suspended: 'danger',
};

export function Users() {
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedData<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [renewModal, setRenewModal] = useState<RenewModalState>({ open: false, userId: '', email: '' });
  const [renewDays, setRenewDays] = useState('30');
  const [renewLoading, setRenewLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const result = await api.get<PaginatedData<User>>('/admin/users', params);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const action = async (id: string, fn: () => Promise<unknown>) => {
    setActionLoading(id);
    try { await fn(); await fetchUsers(); } finally { setActionLoading(null); }
  };

  const handleSuspend = (u: User) =>
    setConfirmModal({
      open: true,
      title: 'Suspend User',
      message: `Suspend ${u.email}? This disables their VPN access immediately.`,
      onConfirm: () => action(u.id, () => api.post(`/admin/users/${u.id}/suspend`)),
    });

  const handleDelete = (u: User) =>
    setConfirmModal({
      open: true,
      title: 'Delete User',
      message: `Permanently delete ${u.email} and remove their VPN peer? This cannot be undone.`,
      onConfirm: () => action(u.id, () => api.delete(`/admin/users/${u.id}`)),
    });

  const handleRenew = async () => {
    setRenewLoading(true);
    try {
      await api.post(`/admin/users/${renewModal.userId}/renew`, { days: parseInt(renewDays, 10) });
      setRenewModal({ open: false, userId: '', email: '' });
      await fetchUsers();
    } finally { setRenewLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Users</h1>
            {data && <p className="text-slate-400 text-sm">{data.total} total</p>}
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/admin/users/new')}>
            Create User
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <Input
              placeholder="Search email or name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  {['User', 'Status', 'Expires', 'VPN IP', 'Actions'].map((h) => (
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
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400">No users found</td></tr>
                ) : data?.items.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3">
                      <p className="text-slate-200 text-sm font-medium">{u.full_name}</p>
                      <p className="text-slate-400 text-xs">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={u.status} variant={statusVariant[u.status]} dot />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300 text-sm">
                        {new Date(u.expiration_date).toLocaleDateString()}
                      </p>
                      <p className="text-slate-500 text-xs">
                        {formatDistanceToNow(new Date(u.expiration_date), { addSuffix: true })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm font-mono">
                        {u.wg_client_ip ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/admin/users/${u.id}`)}
                          title="View"
                          className="p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-700 rounded transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRenewModal({ open: true, userId: u.id, email: u.email })}
                          title="Renew"
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded transition"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        {u.status === 'suspended' ? (
                          <button
                            onClick={() => action(u.id, () => api.post(`/admin/users/${u.id}/reactivate`))}
                            title="Reactivate"
                            disabled={actionLoading === u.id}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded transition disabled:opacity-50"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(u)}
                            title="Suspend"
                            disabled={actionLoading === u.id}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded transition disabled:opacity-50"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(u)}
                          title="Delete"
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <p className="text-slate-400 text-sm">
                Page {page} of {data.pages}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="w-4 h-4" />}>Prev</Button>
                <Button variant="secondary" size="sm" disabled={page === data.pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>

        {/* Renew Modal */}
        <Modal open={renewModal.open} onClose={() => setRenewModal({ open: false, userId: '', email: '' })} title="Renew Subscription">
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">Renew subscription for <strong>{renewModal.email}</strong></p>
            <div className="grid grid-cols-4 gap-2">
              {['30', '60', '90', '180'].map((d) => (
                <button
                  key={d}
                  onClick={() => setRenewDays(d)}
                  className={`py-2 rounded-lg text-sm font-medium border transition
                    ${renewDays === d
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <Input
              label="Or custom days"
              type="number"
              min="1"
              value={renewDays}
              onChange={(e) => setRenewDays(e.target.value)}
            />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setRenewModal({ open: false, userId: '', email: '' })}>Cancel</Button>
              <Button className="flex-1 justify-center" loading={renewLoading} icon={<RotateCcw className="w-4 h-4" />} onClick={handleRenew}>
                Renew {renewDays} Days
              </Button>
            </div>
          </div>
        </Modal>

        {/* Confirm Modal */}
        <Modal open={confirmModal.open} onClose={() => setConfirmModal((m) => ({ ...m, open: false }))} title={confirmModal.title} size="sm">
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">{confirmModal.message}</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setConfirmModal((m) => ({ ...m, open: false }))}>Cancel</Button>
              <Button variant="danger" className="flex-1 justify-center" onClick={() => { confirmModal.onConfirm(); setConfirmModal((m) => ({ ...m, open: false })); }}>Confirm</Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
