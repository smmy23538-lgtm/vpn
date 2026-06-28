import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UserCheck, UserX, RotateCcw, Trash2, Edit2, Save, X,
} from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { User, UserStatus } from '../../types';

const statusVariant: Record<UserStatus, 'success' | 'danger' | 'warning'> = {
  active: 'success', expired: 'warning', suspended: 'danger',
};

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', expiration_date: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [renewModal, setRenewModal] = useState(false);
  const [renewDays, setRenewDays] = useState('30');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const fetchUser = async () => {
    try {
      const u = await api.get<User>(`/admin/users/${id}`);
      setUser(u);
      setEditForm({
        full_name: u.full_name,
        email: u.email,
        expiration_date: u.expiration_date.slice(0, 10),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, [id]);

  const doAction = async (fn: () => Promise<unknown>) => {
    setActionLoading(true);
    try { await fn(); await fetchUser(); } finally { setActionLoading(false); }
  };

  const handleSaveEdit = () =>
    doAction(() =>
      api.put(`/admin/users/${id}`, {
        ...editForm,
        expiration_date: new Date(editForm.expiration_date).toISOString(),
      })
    ).then(() => setEditing(false));

  const handleRenew = () =>
    doAction(async () => {
      await api.post(`/admin/users/${id}/renew`, { days: parseInt(renewDays, 10) });
      setRenewModal(false);
    });

  const handleDelete = () =>
    doAction(async () => {
      await api.delete(`/admin/users/${id}`);
      navigate('/admin/users');
    });

  if (loading) return <AdminLayout><div className="text-slate-400">Loading...</div></AdminLayout>;
  if (!user) return <AdminLayout><div className="text-red-400">User not found</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-6">
        <button onClick={() => navigate('/admin/users')} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </button>

        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{user.full_name}</h1>
            <p className="text-slate-400 text-sm">{user.email}</p>
          </div>
          <Badge label={user.status} variant={statusVariant[user.status]} dot />
        </div>

        {/* Details */}
        <Card title="Account Details" action={
          !editing ? (
            <Button variant="ghost" size="sm" icon={<Edit2 className="w-4 h-4" />} onClick={() => setEditing(true)}>Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" icon={<X className="w-4 h-4" />} onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" icon={<Save className="w-4 h-4" />} loading={actionLoading} onClick={handleSaveEdit}>Save</Button>
            </div>
          )
        }>
          {editing ? (
            <div className="space-y-3">
              <Input label="Full Name" value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} />
              <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              <Input label="Expiration Date" type="date" value={editForm.expiration_date} onChange={(e) => setEditForm((f) => ({ ...f, expiration_date: e.target.value }))} />
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Email', value: user.email },
                { label: 'VPN IP', value: user.wg_client_ip ?? 'Not assigned' },
                { label: 'Activation Date', value: new Date(user.activation_date).toLocaleDateString() },
                { label: 'Expiration Date', value: new Date(user.expiration_date).toLocaleDateString() },
                { label: 'Member Since', value: new Date(user.created_at).toLocaleDateString() },
                { label: 'WireGuard Peer', value: user.wg_client_id ?? 'None' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-slate-700 last:border-0">
                  <span className="text-slate-400 text-sm">{label}</span>
                  <span className="text-slate-200 text-sm font-mono text-right max-w-xs truncate">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Actions */}
        <Card title="Actions">
          <div className="flex flex-wrap gap-3">
            <Button
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => setRenewModal(true)}
              variant="success"
            >
              Renew Subscription
            </Button>
            {user.status === 'suspended' ? (
              <Button
                icon={<UserCheck className="w-4 h-4" />}
                variant="secondary"
                loading={actionLoading}
                onClick={() => doAction(() => api.post(`/admin/users/${id}/reactivate`))}
              >
                Reactivate
              </Button>
            ) : (
              <Button
                icon={<UserX className="w-4 h-4" />}
                variant="secondary"
                loading={actionLoading}
                onClick={() => doAction(() => api.post(`/admin/users/${id}/suspend`))}
              >
                Suspend
              </Button>
            )}
            <Button icon={<Trash2 className="w-4 h-4" />} variant="danger" onClick={() => setDeleteConfirm(true)}>
              Delete User
            </Button>
          </div>
        </Card>

        {/* Renew Modal */}
        <Modal open={renewModal} onClose={() => setRenewModal(false)} title="Renew Subscription" size="sm">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {['30', '60', '90'].map((d) => (
                <button key={d} onClick={() => setRenewDays(d)}
                  className={`py-2 rounded-lg text-sm font-medium border transition
                    ${renewDays === d ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}>
                  {d} days
                </button>
              ))}
            </div>
            <Input label="Custom days" type="number" min="1" value={renewDays} onChange={(e) => setRenewDays(e.target.value)} />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setRenewModal(false)}>Cancel</Button>
              <Button className="flex-1 justify-center" loading={actionLoading} onClick={handleRenew}>Renew {renewDays} Days</Button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirm */}
        <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Delete User" size="sm">
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">
              Permanently delete <strong>{user.email}</strong>? Their WireGuard peer will be removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              <Button variant="danger" className="flex-1 justify-center" loading={actionLoading} onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
