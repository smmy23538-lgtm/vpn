import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { VpnStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';

const WS_URL = import.meta.env.VITE_WS_URL ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export function useVpn() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<VpnStatus>('/vpn/status');
      setStatus(data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'vpn_status') setStatus(msg.payload as VpnStatus);
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      reconnectTimer.current = setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = () => ws.close();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStatus();
    connectWebSocket();
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
    a.href = url;
    a.download = 'securevpn.conf';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { status, loading, fetchStatus, downloadConfig };
}
