import { query } from '../config/database';
import { listServers } from './server.service';
import { wgManager } from './wgeasy.manager';
import { logger } from '../utils/logger';

export interface DailyStats {
  date: string;
  new_users: number;
  active_users: number;
  connections: number;
  bytes_rx: number;
  bytes_tx: number;
}

export interface AnalyticsSummary {
  total_bandwidth_rx: number;
  total_bandwidth_tx: number;
  total_connections: number;
  avg_session_minutes: number;
  top_server: string | null;
  top_country: string | null;
  daily: DailyStats[];
  hourly_connections: { hour: number; count: number }[];
  status_breakdown: { status: string; count: number }[];
  expiring_this_week: number;
  new_users_this_month: number;
}

export async function getAnalytics(days = 30): Promise<AnalyticsSummary> {
  const [bw] = await query<{ rx: string; tx: string; cnt: string; avg_sec: string }>(
    `SELECT
       COALESCE(SUM(bytes_rx), 0)::text          AS rx,
       COALESCE(SUM(bytes_tx), 0)::text          AS tx,
       COUNT(*)::text                             AS cnt,
       COALESCE(AVG(duration_seconds), 0)::text  AS avg_sec
     FROM connections
     WHERE connected_at >= NOW() - ($1 || ' days')::INTERVAL`,
    [days]
  );

  const daily = await query<DailyStats>(
    `SELECT
       DATE(d)::text                                            AS date,
       (SELECT COUNT(*) FROM users WHERE DATE(created_at) = DATE(d))::int AS new_users,
       (SELECT COUNT(*) FROM users WHERE status = 'active')::int          AS active_users,
       COALESCE((SELECT COUNT(*) FROM connections WHERE DATE(connected_at) = DATE(d)), 0)::int AS connections,
       COALESCE((SELECT SUM(bytes_rx) FROM connections WHERE DATE(connected_at) = DATE(d)), 0)::bigint AS bytes_rx,
       COALESCE((SELECT SUM(bytes_tx) FROM connections WHERE DATE(connected_at) = DATE(d)), 0)::bigint AS bytes_tx
     FROM generate_series(NOW() - ($1 || ' days')::INTERVAL, NOW(), '1 day'::INTERVAL) d
     ORDER BY d DESC`,
    [days]
  );

  const topServerRows = await query<{ name: string; cnt: string }>(
    `SELECT s.name, COUNT(c.id)::text AS cnt
     FROM connections c JOIN servers s ON c.server_id = s.id
     WHERE c.connected_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY s.name ORDER BY cnt DESC LIMIT 1`,
    [days]
  );

  const topCountryRows = await query<{ country: string; cnt: string }>(
    `SELECT s.country, COUNT(c.id)::text AS cnt
     FROM connections c JOIN servers s ON c.server_id = s.id
     WHERE c.connected_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY s.country ORDER BY cnt DESC LIMIT 1`,
    [days]
  );

  const hourly = await query<{ hour: number; count: number }>(
    `SELECT EXTRACT(HOUR FROM connected_at)::int AS hour, COUNT(*)::int AS count
     FROM connections
     WHERE connected_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY hour ORDER BY hour`,
    [days]
  );

  const statusBreakdown = await query<{ status: string; count: number }>(
    `SELECT status, COUNT(*)::int AS count FROM users WHERE role = 'customer' GROUP BY status`
  );

  const [{ expiring }] = await query<{ expiring: string }>(
    `SELECT COUNT(*)::text AS expiring FROM users
     WHERE status = 'active' AND expiration_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'`
  );

  const [{ new_this_month }] = await query<{ new_this_month: string }>(
    `SELECT COUNT(*)::text AS new_this_month FROM users
     WHERE role = 'customer' AND created_at >= date_trunc('month', NOW())`
  );

  return {
    total_bandwidth_rx: parseInt(bw.rx, 10),
    total_bandwidth_tx: parseInt(bw.tx, 10),
    total_connections: parseInt(bw.cnt, 10),
    avg_session_minutes: Math.round(parseFloat(bw.avg_sec) / 60),
    top_server: topServerRows[0]?.name ?? null,
    top_country: topCountryRows[0]?.country ?? null,
    daily,
    hourly_connections: hourly,
    status_breakdown: statusBreakdown,
    expiring_this_week: parseInt(expiring, 10),
    new_users_this_month: parseInt(new_this_month, 10),
  };
}

export async function takeAnalyticsSnapshot(): Promise<void> {
  const servers = await listServers();
  for (const s of servers) {
    if (!s.is_active) continue;
    try {
      const wg = wgManager.getInstance({
        url: `http://${s.host}:${s.port}`,
        password: s.wg_password ?? '',
      });
      const clients = await wg.listClients();
      const rx = clients.reduce((a, c) => a + c.transferRx, 0);
      const tx = clients.reduce((a, c) => a + c.transferTx, 0);
      const peers = clients.filter((c) => wg.isConnected(c)).length;
      await query(
        `INSERT INTO bandwidth_snapshots (server_id, bytes_rx, bytes_tx, peer_count)
         VALUES ($1, $2, $3, $4)`,
        [s.id, rx, tx, peers]
      );
    } catch (err) {
      logger.warn('Analytics snapshot failed', { serverId: s.id, error: String(err) });
    }
  }
}

export async function getBandwidthHistory(
  serverId: string | null,
  hours = 24
): Promise<{ time: string; rx: number; tx: number; peers: number }[]> {
  const where = serverId ? 'AND server_id = $2' : '';
  const params: unknown[] = [hours];
  if (serverId) params.push(serverId);

  return query(
    `SELECT
       to_char(snapshot_at, 'HH24:MI') AS time,
       bytes_rx::bigint AS rx,
       bytes_tx::bigint AS tx,
       peer_count AS peers
     FROM bandwidth_snapshots
     WHERE snapshot_at >= NOW() - ($1 || ' hours')::INTERVAL ${where}
     ORDER BY snapshot_at`,
    params
  );
}
