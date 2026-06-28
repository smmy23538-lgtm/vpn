import React, { useState } from 'react';
import { User, Mail, Calendar, Shield, Key, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { api } from '../../api/client';

export function Account() {
  const { user } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  if (!user) return null;

  const daysLeft = Math.ceil(
    (new Date(user.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const statusVariant =
    user.status === 'active' ? 'success' : user.status === 'suspended' ? 'danger' : 'warning';

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    setPwLoading(true);
    setPwError('');
    try {
      await api.put('/auth/password', { current_password: currentPw, new_password: newPw });
      setPwSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPwSuccess(false);
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
      }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPwError(msg ?? 'Failed to update password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <h1 className="text-xl font-bold text-slate-100">Account</h1>

        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-brand-600/30 border border-brand-600/50 flex items-center justify-center">
              <User className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <p className="text-slate-100 font-semibold">{user.full_name}</p>
              <p className="text-slate-400 text-sm">{user.email}</p>
            </div>
          </div>

          <div className="space-y-3">
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
            <InfoRow
              icon={<Shield className="w-4 h-4" />}
              label="Status"
              value={<Badge label={user.status.charAt(0).toUpperCase() + user.status.slice(1)} variant={statusVariant} dot />}
            />
            <InfoRow
              icon={<Calendar className="w-4 h-4" />}
              label="Active since"
              value={new Date(user.activation_date).toLocaleDateString()}
            />
            <InfoRow
              icon={<Calendar className="w-4 h-4" />}
              label="Expires"
              value={`${new Date(user.expiration_date).toLocaleDateString()} ${daysLeft > 0 ? `(${daysLeft}d left)` : '(expired)'}`}
            />
          </div>
        </Card>

        <Card title="Security">
          <Button
            variant="secondary"
            icon={<Key className="w-4 h-4" />}
            onClick={() => setShowPasswordModal(true)}
          >
            Change Password
          </Button>
        </Card>

        <Modal
          open={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          title="Change Password"
        >
          {pwSuccess ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <p className="text-slate-200 font-medium">Password updated!</p>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {pwError && (
                <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
                  {pwError}
                </div>
              )}
              <Input
                label="Current Password"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
              />
              <Input
                label="New Password"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
              />
              <Button type="submit" className="w-full justify-center" loading={pwLoading}>
                Update Password
              </Button>
            </form>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}

function InfoRow({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        {icon}
        {label}
      </div>
      <div className="text-slate-200 text-sm text-right">{value}</div>
    </div>
  );
}
