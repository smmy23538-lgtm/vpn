import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, ShieldOff, Globe, Clock, ArrowDown, ArrowUp,
  AlertCircle, Wifi, Download, ChevronDown, Zap, CheckCircle, XCircle,
} from 'lucide-react';
import { useVpn } from '../../hooks/useVpn';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/client';
import { AppLayout } from '../../components/layout/AppLayout';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { SetupWizard } from '../../components/vpn/SetupWizard';
import { differenceInSeconds, isAfter } from 'date-fns';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Dashboard() {
  const { status, loading, servers, speedRx, speedTx, downloadConfig } = useVpn();
  const { user, refreshUser } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showServerList, setShowServerList] = useState(false);
  const [serverSwitching, setServerSwitching] = useState(false);
  const [serverMsg, setServerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connection timer
  useEffect(() => {
    if (status?.connected && status.latest_handshake) {
      const startTime = new Date(status.latest_handshake);
      const update = () => setSessionSeconds(differenceInSeconds(new Date(), startTime));
      update();
      timerRef.current = setInterval(update, 1000);
    } else {
      setSessionSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status?.connected, status?.latest_handshake]);

  const isExpired = user ? isAfter(new Date(), new Date(user.expiration_date)) : false;
  const daysLeft = user
    ? Math.ceil((new Date(user.expiration_date).getTime() - Date.now()) / 86400000)
    : 0;
  const canConnect = user?.status === 'active' && !isExpired;

  const currentServer = servers.find((s) => s.id === user?.server_id) ?? servers[0];

  const handleServerChange = async (serverId: string) => {
    if (serverId === user?.server_id || serverSwitching) return;
    setShowServerList(false);
    setServerSwitching(true);
    setServerMsg(null);
    try {
      await api.put('/vpn/server', { server_id: serverId });
      await refreshUser();
      setServerMsg({ type: 'ok', text: 'Server changed — download your new VPN config to reconnect.' });
    } catch {
      setServerMsg({ type: 'err', text: 'Failed to switch server. Please try again.' });
    } finally {
      setServerSwitching(false);
      setTimeout(() => setServerMsg(null), 6000);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 pb-4">

        {/* Server change status message */}
        {serverMsg && (
          <div className={`mx-4 mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm border
            ${serverMsg.type === 'ok'
              ? 'bg-emerald-900/20 border-emerald-700/60 text-emerald-300'
              : 'bg-red-900/20 border-red-700/60 text-red-300'}`}>
            {serverMsg.type === 'ok'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <XCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{serverMsg.text}</span>
          </div>
        )}

        {/* Server selector strip */}
        <div className="px-4 pt-4">
          <button
            onClick={() => setShowServerList((v) => !v)}
            className="w-full flex items-center justify-between bg-slate-800/70 border border-slate-700
                       rounded-xl px-4 py-3 text-left hover:bg-slate-700/70 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{currentServer?.flag ?? '🌐'}</span>
              <div>
                <p className="text-slate-200 text-sm font-semibold">
                  {currentServer?.name ?? 'Best Available'}
                </p>
                <p className="text-slate-400 text-xs">
                  {currentServer?.country ?? 'Automatic'}
                  {currentServer?.latency_ms ? ` · ${currentServer.latency_ms}ms` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentServer && (
                <Badge
                  label={currentServer.status}
                  variant={currentServer.status === 'online' ? 'success' : 'danger'}
                  dot
                />
              )}
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showServerList ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Server dropdown */}
          {showServerList && servers.length > 0 && (
            <div className="mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-10 relative">
              {servers.filter((s) => s.is_active).map((s) => (
                <button
                  key={s.id}
                  disabled={serverSwitching}
                  onClick={() => handleServerChange(s.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/60
                             transition border-b border-slate-700/50 last:border-0 disabled:opacity-50
                             ${s.id === user?.server_id ? 'bg-brand-900/30' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{s.flag ?? '🌐'}</span>
                    <div className="text-left">
                      <p className="text-slate-200 text-sm font-medium">{s.name}</p>
                      <p className="text-slate-400 text-xs">{s.city ? `${s.city}, ` : ''}{s.country}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {s.latency_ms && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{s.latency_ms}ms</span>}
                    <Badge label={s.status} variant={s.status === 'online' ? 'success' : 'danger'} dot />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main connect orb */}
        <div className="flex flex-col items-center justify-center flex-1 px-4 py-6">
          {/* Outer glow rings */}
          <div className="relative flex items-center justify-center mb-8">
            {status?.connected && (
              <>
                <div className="absolute w-72 h-72 rounded-full border-2 border-emerald-500/10 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute w-60 h-60 rounded-full border-2 border-emerald-500/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
              </>
            )}

            {/* Orb button */}
            <button
              onClick={() => canConnect && setShowSetup(true)}
              disabled={!canConnect || loading}
              className={`
                relative w-52 h-52 rounded-full flex flex-col items-center justify-center
                transition-all duration-500 select-none
                focus:outline-none focus:ring-4 focus:ring-offset-4 focus:ring-offset-slate-950
                disabled:cursor-not-allowed
                ${loading
                  ? 'bg-slate-800 border-4 border-slate-700'
                  : status?.connected
                    ? 'bg-gradient-to-b from-emerald-500/20 to-emerald-700/30 border-4 border-emerald-500 shadow-[0_0_80px_rgba(16,185,129,0.35)] focus:ring-emerald-500/50'
                    : canConnect
                      ? 'bg-gradient-to-b from-slate-700/60 to-slate-800/80 border-4 border-slate-600 hover:border-brand-500 hover:shadow-[0_0_40px_rgba(14,165,233,0.2)] focus:ring-brand-500/50'
                      : 'bg-red-900/20 border-4 border-red-800/50'
                }
              `}
            >
              {loading ? (
                <Shield className="w-20 h-20 text-slate-500 animate-pulse" />
              ) : status?.connected ? (
                <Shield className="w-20 h-20 text-emerald-400 drop-shadow-lg" />
              ) : (
                <ShieldOff className={`w-20 h-20 ${canConnect ? 'text-slate-400' : 'text-red-600/60'}`} />
              )}
              <span className={`mt-2 text-sm font-bold tracking-widest uppercase
                ${loading ? 'text-slate-500' : status?.connected ? 'text-emerald-400' : canConnect ? 'text-slate-400' : 'text-red-500/60'}`}>
                {loading ? '···' : status?.connected ? 'Connected' : canConnect ? 'Tap to Connect' : 'Access Revoked'}
              </span>
            </button>
          </div>

          {/* Session timer */}
          {status?.connected && (
            <div className="flex items-center gap-2 text-emerald-400 mb-6">
              <Clock className="w-4 h-4" />
              <span className="text-lg font-mono font-semibold">{formatDuration(sessionSeconds)}</span>
            </div>
          )}

          {/* Expiry warning */}
          {user?.status === 'active' && (isExpired || daysLeft <= 7) && (
            <div className={`w-full max-w-sm flex items-start gap-3 rounded-xl p-3 mb-4 border text-sm
              ${isExpired ? 'bg-red-900/20 border-red-700/60 text-red-300' : 'bg-amber-900/20 border-amber-700/60 text-amber-300'}`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{isExpired ? 'Subscription expired. Contact administrator to renew.' : `Subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}</span>
            </div>
          )}

          {/* VPN IP */}
          {status?.vpn_ip && (
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
              <Wifi className="w-4 h-4" />
              <span className="font-mono">{status.vpn_ip}</span>
            </div>
          )}

          {/* Stats row */}
          <div className="w-full max-w-sm grid grid-cols-2 gap-3 mb-6">
            <StatCard
              label="Download"
              value={formatBytes(status?.transfer_rx ?? 0)}
              speed={status?.connected ? formatSpeed(speedRx) : null}
              icon={<ArrowDown className="w-4 h-4 text-brand-400" />}
            />
            <StatCard
              label="Upload"
              value={formatBytes(status?.transfer_tx ?? 0)}
              speed={status?.connected ? formatSpeed(speedTx) : null}
              icon={<ArrowUp className="w-4 h-4 text-emerald-400" />}
            />
          </div>

          {/* Action buttons */}
          <div className="w-full max-w-sm space-y-2">
            {!user?.wg_client_id ? (
              <Button size="lg" className="w-full justify-center" onClick={() => setShowSetup(true)} disabled={!canConnect} icon={<Download className="w-5 h-5" />}>
                Set Up VPN
              </Button>
            ) : (
              <Button
                size="lg"
                variant="secondary"
                className="w-full justify-center"
                onClick={() => setShowSetup(true)}
                icon={<Globe className="w-4 h-4" />}
              >
                Setup / Download Config
              </Button>
            )}
          </div>

          {/* Subscription row */}
          <div className="w-full max-w-sm mt-4 bg-slate-800/50 border border-slate-700/60 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs">Subscription</p>
              {user && (
                <p className="text-slate-200 text-sm">
                  {isExpired ? 'Expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
                </p>
              )}
            </div>
            <Badge
              label={user?.status ?? 'unknown'}
              variant={user?.status === 'active' ? (daysLeft <= 7 ? 'warning' : 'success') : 'danger'}
              dot
            />
          </div>
        </div>
      </div>

      <SetupWizard open={showSetup} onClose={() => setShowSetup(false)} onDownload={downloadConfig} />
    </AppLayout>
  );
}

function StatCard({
  icon, label, value, speed,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  speed: string | null;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">{icon}<span className="text-slate-400 text-xs">{label}</span></div>
      <p className="text-slate-100 font-semibold text-base">{value}</p>
      {speed && <p className="text-slate-400 text-xs mt-0.5">{speed}</p>}
    </div>
  );
}
