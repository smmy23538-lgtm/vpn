import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { VpnStatus, Server } from '../types';
import { useAuth } from '../contexts/AuthContext';

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export function useVpn() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [speedRx, setSpeedRx] = useState(0);
  const [speedTx, setSpeedTx] = useState(0);
  const prevRx = useRef(0);
  const prevTx = useRef(0);
  const prevTime = useRef(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<VpnStatus>('/vpn/status');
      setStatus(data);
      // Compute speed from delta
      const now = Date.now();
      const elapsed = (now - prevTime.current) / 1000;
      if (elapsed > 0 && (prevRx.current > 0 || prevTx.current > 0)) {
        setSpeedRx(Math.max(0, data.transfer_rx - prevRx.current) / elapsed);
        setSpeedTx(Math.max(0, data.transfer_tx - prevTx.current) / elapsed);
      }
      prevRx.current = data.transfer_rx;
      prevTx.current = data.transfer_tx;
      prevTime.current = now;
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'vpn_status') {
          const data = msg.payload as VpnStatus;
          setStatus(data);
          const now = Date.now();
          const elapsed = (now - prevTime.current) / 1000;
          if (elapsed > 0) {
            setSpeedRx(Math.max(0, data.transfer_rx - prevRx.current) / elapsed);
            setSpeedTx(Math.max(0, data.transfer_tx - prevTx.current) / elapsed);
          }
          prevRx.current = data.transfer_rx;
          prevTx.current = data.transfer_tx;
          prevTime.current = now;
        }
      } catch { /* ignore */ }
    };
    ws.onclose = () => { reconnectTimer.current = setTimeout(connectWebSocket, 5000); };
    ws.onerror = () => ws.close();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStatus();
    connectWebSocket();
    api.get<Server[]>('/servers').then(setServers).catch(() => {});
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [isAuthenticated, fetchStatus, connectWebSocket]);

  const downloadConfig = useCallback(async () => {
    const config = await api.getRaw('/vpn/config');
    const blob = new Blob([config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'securevpn.conf'; a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { status, loading, servers, speedRx, speedTx, fetchStatus, downloadConfig };
}
