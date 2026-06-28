import React, { useState } from 'react';
import {
  Shield, ShieldOff, Globe, Clock, Wifi,
  WifiOff, Download, ArrowDown, ArrowUp, AlertCircle,
} from 'lucide-react';
import { useVpn } from '../../hooks/useVpn';
import { useAuth } from '../../contexts/AuthContext';
import { AppLayout } from '../../components/layout/AppLayout';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { SetupWizard } from '../../components/vpn/SetupWizard';
import { formatDistanceToNow, isAfter } from 'date-fns';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function getDaysLeft(expiry: string): number {
  const diff = new Date(expiry).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function Dashboard() {
  const { status, loading, downloadConfig } = useVpn();
  const { user } = useAuth();
  const [showSetup, setShowSetup] = useState(false);

  const isExpired = user ? isAfter(new Date(), new Date(user.expiration_date)) : false;
  const daysLeft = user ? getDaysLeft(user.expiration_date) : 0;
  const subscriptionStatus =
    user?.status === 'suspended'
      ? { label: 'Suspended', variant: 'danger' as const }
      : isExpired
      ? { label: 'Expired', variant: 'danger' as const }
      : daysLeft <= 7
      ? { label: `${daysLeft}d left`, variant: 'warning' as const }
      : { label: 'Active', variant: 'success' as const };

  const canConnect = user?.status === 'active' && !isExpired;

  return (
    <AppLayout>
      <div className="min-h-full bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center px-4 py-8">
        {/* Connection Status Orb */}
        <div className="flex flex-col items-center mb-8">
          <div className={`
            relative w-48 h-48 rounded-full flex flex-col items-center justify-center
            border-4 transition-all duration-700 mb-4
            ${loading
              ? 'border-slate-600 bg-slate-800'
              : status?.connected
              ? 'border-emerald-500 bg-emerald-900/20 shadow-[0_0_60px_rgba(16,185,129,0.25)]'
              : canConnect
              ? 'border-slate-600 bg-slate-800/60'
              : 'border-red-700 bg-red-900/10'
            }
          `}>
            {/* Animated ring when connected */}
            {status?.connected && (
              <div className="absolute inset-0 rounded-full border-4 border-emerald-400/30 animate-ping" />
            )}

            {loading ? (
              <Shield className="w-16 h-16 text-slate-500 animate-pulse" />
            ) : status?.connected ? (
              <Shield className="w-16 h-16 text-emerald-400" />
            ) : (
              <ShieldOff className="w-16 h-16 text-slate-500" />
            )}

            <span className={`mt-2 text-sm font-semibold tracking-wide
              ${status?.connected ? 'text-emerald-400' : 'text-slate-400'}`}>
              {loading ? 'Checking...' : status?.connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          {status?.vpn_ip && (
            <p className="text-slate-400 text-sm font-mono">{status.vpn_ip}</p>
          )}
        </div>

        {/* Server Info */}
        <div className="w-full max-w-sm bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-brand-400 flex-shrink-0" />
              <div>
                <p className="text-slate-200 font-medium text-sm">
                  {status?.server_name ?? 'US East'}
                </p>
                <p className="text-slate-400 text-xs">{status?.server_country ?? 'United States'}</p>
              </div>
            </div>
            <Badge
              label={status?.connected ? 'Online' : 'Ready'}
              variant={status?.connected ? 'success' : 'neutral'}
              dot
            />
          </div>
        </div>

        {/* Subscription warning */}
        {(isExpired || daysLeft <= 7) && user?.status === 'active' && (
          <div className={`w-full max-w-sm flex items-start gap-3 rounded-xl p-4 mb-6 border
            ${isExpired
              ? 'bg-red-900/20 border-red-700 text-red-300'
              : 'bg-amber-900/20 border-amber-700 text-amber-300'}`}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              {isExpired
                ? 'Your subscription has expired. Contact your administrator to renew.'
                : `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Contact your administrator to renew.`}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-3">
          {!user?.wg_client_id ? (
            <Button
              size="lg"
              className="w-full justify-center"
              onClick={() => setShowSetup(true)}
              disabled={!canConnect}
              icon={<Download className="w-5 h-5" />}
            >
              Set Up VPN
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant={status?.connected ? 'danger' : 'success'}
                className="w-full justify-center"
                disabled={!canConnect || loading}
                icon={status?.connected ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
                onClick={() => setShowSetup(true)}
              >
                {status?.connected ? 'Disconnect' : 'Connect'}
              </Button>

              <Button
                size="md"
                variant="secondary"
                className="w-full justify-center"
                onClick={() => setShowSetup(true)}
                icon={<Download className="w-4 h-4" />}
              >
                Setup / Download Config
              </Button>
            </>
          )}
        </div>

        {/* Stats */}
        {status?.connected && (
          <div className="w-full max-w-sm mt-6 grid grid-cols-3 gap-3">
            <StatCard
              icon={<ArrowDown className="w-4 h-4 text-brand-400" />}
              label="Download"
              value={formatBytes(status.transfer_rx)}
            />
            <StatCard
              icon={<ArrowUp className="w-4 h-4 text-emerald-400" />}
              label="Upload"
              value={formatBytes(status.transfer_tx)}
            />
            <StatCard
              icon={<Clock className="w-4 h-4 text-amber-400" />}
              label="Last seen"
              value={status.latest_handshake
                ? formatDistanceToNow(new Date(status.latest_handshake), { addSuffix: true })
                : 'Never'}
            />
          </div>
        )}

        {/* Subscription card */}
        <div className="w-full max-w-sm mt-6 bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Subscription</span>
            <Badge label={subscriptionStatus.label} variant={subscriptionStatus.variant} dot />
          </div>
          {user && (
            <p className="text-slate-500 text-xs mt-1">
              Expires: {new Date(user.expiration_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Setup Wizard */}
      <SetupWizard
        open={showSetup}
        onClose={() => setShowSetup(false)}
        onDownload={downloadConfig}
      />
    </AppLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex flex-col items-center gap-1">
      {icon}
      <span className="text-slate-100 text-xs font-semibold text-center">{value}</span>
      <span className="text-slate-500 text-xs">{label}</span>
    </div>
  );
}
