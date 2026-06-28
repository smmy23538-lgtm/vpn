import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Server as ServerType, Country } from '../../types';

interface ServerForm {
  name: string; country: string; country_id: string; city: string;
  flag: string; host: string; port: string; wg_host: string;
  wg_port: string; wg_password: string; max_users: string; description: string;
}

const empty: ServerForm = {
  name: '', country: '', country_id: '', city: '', flag: '',
  host: '', port: '51821', wg_host: '', wg_port: '51830',
  wg_password: '', max_users: '100', description: '',
};

export function Servers() {
  const [servers, setServers] = useState<ServerType[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ServerForm>(empty);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [s, c] = await Promise.all([
      api.get<ServerType[]>('/servers'),
      api.get<Country[]>('/countries'),
    ]);
    setServers(s); setCountries(c);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const set = (k: keyof ServerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => { setEditId(null); setForm(empty); setModalOpen(true); };
  const openEdit = (s: ServerType) => {
    setEditId(s.id);
    setForm({
      name: s.name, country: s.country, country_id: s.country_id ?? '',
      city: s.city ?? '', flag: s.flag ?? '', host: s.host,
      port: String(s.port), wg_host: s.wg_host, wg_port: String(s.wg_port),
      wg_password: '', max_users: String(s.max_users), description: s.description ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        port: parseInt(form.port, 10),
        wg_port: parseInt(form.wg_port, 10),
        max_users: parseInt(form.max_users, 10),
        country_id: form.country_id || undefined,
        wg_password: form.wg_password || undefined,
      };
      if (editId) await api.put(`/servers/${editId}`, body);
      else await api.post('/servers', body);
      setModalOpen(false); await fetch();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/servers/${id}`);
    setDeleteConfirm(null); await fetch();
  };

  const checkHealth = async (id: string) => {
    setChecking(id);
    try { await api.get(`/servers/${id}/health`); await fetch(); }
    finally { setChecking(null); }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Servers</h1>
            <p className="text-slate-400 text-sm">{servers.length} server{servers.length !== 1 ? 's' : ''} configured</p>
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Add Server</Button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-center py-12">Loading...</div>
        ) : servers.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No servers yet. Add your first VPN server.</p>
              <Button className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Add Server</Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {servers.map((s) => (
              <div key={s.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{s.flag ?? '🌐'}</span>
                    <div>
                      <p className="text-slate-100 font-semibold">{s.name}</p>
                      <p className="text-slate-400 text-sm">{s.city ? `${s.city}, ` : ''}{s.country}</p>
                    </div>
                  </div>
                  <Badge
                    label={s.status}
                    variant={s.status === 'online' ? 'success' : s.status === 'maintenance' ? 'warning' : 'danger'}
                    dot
                  />
                </div>

                <div className="space-y-1.5 text-sm mb-4">
                  <Row label="Host" value={s.host} />
                  <Row label="WG Port" value={String(s.wg_port)} />
                  {s.latency_ms !== null && <Row label="Latency" value={`${s.latency_ms}ms`} />}
                  <Row
                    label="Users"
                    value={`${s.current_users} / ${s.max_users}`}
                    highlight={(s.current_users ?? 0) >= s.max_users}
                  />
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-700">
                  <button
                    onClick={() => checkHealth(s.id)}
                    disabled={checking === s.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    {checking === s.id
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : s.status === 'online'
                        ? <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
                    Ping
                  </button>
                  <button onClick={() => openEdit(s)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-brand-400 hover:bg-slate-700 transition">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => setDeleteConfirm(s.id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-slate-700 transition">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Server' : 'Add Server'} size="lg">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Server Name" value={form.name} onChange={set('name')} placeholder="US East #1" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Country</label>
              <select
                value={form.country_id}
                onChange={(e) => {
                  const c = countries.find((c) => c.id === e.target.value);
                  setForm((f) => ({ ...f, country_id: e.target.value, country: c?.name ?? f.country, flag: c?.flag ?? f.flag }));
                }}
                className="bg-slate-900 border border-slate-600 rounded-lg py-2 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select country...</option>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}
              </select>
            </div>
            <Input label="City (optional)" value={form.city} onChange={set('city')} placeholder="New York" />
            <Input label="Flag emoji (optional)" value={form.flag} onChange={set('flag')} placeholder="🇺🇸" />
            <Input label="Management Host (wg-easy IP)" value={form.host} onChange={set('host')} placeholder="1.2.3.4" />
            <Input label="Management Port" value={form.port} onChange={set('port')} type="number" placeholder="51821" />
            <Input label="WireGuard Host (public IP)" value={form.wg_host} onChange={set('wg_host')} placeholder="1.2.3.4" />
            <Input label="WireGuard Port (UDP)" value={form.wg_port} onChange={set('wg_port')} type="number" placeholder="51830" />
            <Input label="wg-easy Password" value={form.wg_password} onChange={set('wg_password')} type="password" placeholder={editId ? 'Leave blank to keep current' : 'Password'} />
            <Input label="Max Users" value={form.max_users} onChange={set('max_users')} type="number" placeholder="100" />
          </div>
          <div className="mt-3">
            <Input label="Description (optional)" value={form.description} onChange={set('description')} placeholder="Primary US server" />
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1 justify-center" loading={saving} onClick={handleSave}>
              {editId ? 'Save Changes' : 'Add Server'}
            </Button>
          </div>
        </Modal>

        {/* Delete confirm */}
        <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Server" size="sm">
          <p className="text-slate-300 text-sm mb-4">This will permanently delete the server. Users assigned to it will lose their server assignment.</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1 justify-center" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${highlight ? 'text-red-400' : 'text-slate-300'}`}>{value}</span>
    </div>
  );
}
