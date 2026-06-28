import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

function defaultExpiry(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CreateUser() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    activation_date: new Date().toISOString().slice(0, 10),
    expiration_date: defaultExpiry(30),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/admin/users', {
        ...form,
        activation_date: new Date(form.activation_date).toISOString(),
        expiration_date: new Date(form.expiration_date).toISOString(),
      });
      navigate('/admin/users');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-lg">
        <button
          onClick={() => navigate('/admin/users')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>

        <h1 className="text-2xl font-bold text-slate-100 mb-6">Create User</h1>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Input label="Full Name" value={form.full_name} onChange={set('full_name')} required placeholder="John Doe" />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} required placeholder="john@example.com" />
            <Input label="Password" type="password" value={form.password} onChange={set('password')} required placeholder="Min 8 characters" />

            <div className="border-t border-slate-700 pt-4">
              <p className="text-slate-400 text-sm mb-3 font-medium">Subscription</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, expiration_date: defaultExpiry(d) }))}
                    className="py-2 rounded-lg text-sm bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 transition"
                  >
                    {d} days
                  </button>
                ))}
              </div>
              <Input label="Activation Date" type="date" value={form.activation_date} onChange={set('activation_date')} required />
              <Input label="Expiration Date" type="date" value={form.expiration_date} onChange={set('expiration_date')} required />
            </div>

            <div className="bg-brand-900/20 border border-brand-700/40 rounded-lg p-3 text-sm text-brand-300">
              WireGuard credentials will be automatically generated and the VPN peer will be enabled immediately.
            </div>

            <Button type="submit" size="lg" className="w-full justify-center" loading={loading} icon={<UserPlus className="w-5 h-5" />}>
              Create User & Provision VPN
            </Button>
          </form>
        </Card>
      </div>
    </AdminLayout>
  );
}
