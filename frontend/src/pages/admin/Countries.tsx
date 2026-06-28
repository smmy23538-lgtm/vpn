import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Globe } from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Country } from '../../types';

interface CountryForm {
  name: string; code: string; flag: string; region: string; is_active: boolean;
}

const empty: CountryForm = { name: '', code: '', flag: '', region: '', is_active: true };

export function Countries() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CountryForm>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get<Country[]>('/countries');
    setCountries(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof CountryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = k === 'is_active' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  const openCreate = () => { setEditId(null); setForm(empty); setModalOpen(true); };
  const openEdit = (c: Country) => {
    setEditId(c.id);
    setForm({ name: c.name, code: c.code, flag: c.flag ?? '', region: c.region ?? '', is_active: c.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) await api.put(`/countries/${editId}`, form);
      else await api.post('/countries', form);
      setModalOpen(false); await load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/countries/${id}`);
    setDeleteConfirm(null); await load();
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Countries</h1>
            <p className="text-slate-400 text-sm">{countries.length} countr{countries.length !== 1 ? 'ies' : 'y'} configured</p>
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Add Country</Button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-center py-12">Loading...</div>
        ) : countries.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <Globe className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No countries yet. Add countries to use with servers.</p>
              <Button className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Add Country</Button>
            </div>
          </Card>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 font-medium px-4 py-3">Country</th>
                  <th className="text-left text-slate-400 font-medium px-4 py-3">Code</th>
                  <th className="text-left text-slate-400 font-medium px-4 py-3 hidden md:table-cell">Region</th>
                  <th className="text-left text-slate-400 font-medium px-4 py-3 hidden sm:table-cell">Servers</th>
                  <th className="text-left text-slate-400 font-medium px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {countries.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{c.flag ?? '🌐'}</span>
                        <span className="text-slate-200 font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono uppercase">{c.code}</td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{c.region ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">{c.server_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge label={c.is_active ? 'Active' : 'Inactive'} variant={c.is_active ? 'success' : 'neutral'} dot />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-brand-400 transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirm(c.id)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Country' : 'Add Country'} size="md">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Country Name" value={form.name} onChange={set('name')} placeholder="United States" />
              <Input label="ISO Code (2-letter)" value={form.code} onChange={set('code')} placeholder="US" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Flag Emoji" value={form.flag} onChange={set('flag')} placeholder="🇺🇸" />
              <Input label="Region (optional)" value={form.region} onChange={set('region')} placeholder="North America" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-brand-500"
              />
              <span className="text-sm text-slate-300">Active (visible to users)</span>
            </label>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1 justify-center" loading={saving} onClick={handleSave}>
              {editId ? 'Save Changes' : 'Add Country'}
            </Button>
          </div>
        </Modal>

        {/* Delete confirm */}
        <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Country" size="sm">
          <p className="text-slate-300 text-sm mb-4">
            This will permanently delete the country. Servers assigned to this country will lose their country reference.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1 justify-center" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
