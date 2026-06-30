import { query, queryOne } from '../config/database';
import { wgManager } from './wgeasy.manager';
import { NotFoundError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { encrypt, decrypt } from '../utils/crypto';

function encryptPw(pw: string | null | undefined): string | null {
  if (!pw) return null;
  return encrypt(pw);
}

function decryptPw(enc: string | null | undefined): string | null {
  if (!enc) return null;
  try { return decrypt(enc); } catch { return null; }
}

export interface ServerRecord {
  id: string;
  name: string;
  country: string;
  country_id: string | null;
  city: string | null;
  flag: string | null;
  host: string;
  port: number;
  wg_host: string;
  wg_port: number;
  wg_password: string | null;
  status: 'online' | 'offline' | 'maintenance';
  is_active: boolean;
  max_users: number;
  latency_ms: number | null;
  description: string | null;
  created_at: Date;
  current_users?: number;
}

export async function listServers(): Promise<ServerRecord[]> {
  const rows = await query<ServerRecord>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM users u WHERE u.server_id = s.id AND u.status = 'active')::int AS current_users
     FROM servers s ORDER BY s.is_active DESC, s.name`
  );
  return rows.map((s) => ({ ...s, wg_password: decryptPw(s.wg_password) }));
}

export async function getServer(id: string): Promise<ServerRecord | null> {
  const s = await queryOne<ServerRecord>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM users u WHERE u.server_id = s.id AND u.status = 'active')::int AS current_users
     FROM servers s WHERE s.id = $1`,
    [id]
  );
  if (!s) return null;
  return { ...s, wg_password: decryptPw(s.wg_password) };
}

export async function createServer(data: {
  name: string;
  country: string;
  country_id?: string;
  city?: string;
  flag?: string;
  host: string;
  port?: number;
  wg_host: string;
  wg_port?: number;
  wg_password?: string;
  max_users?: number;
  description?: string;
}): Promise<ServerRecord> {
  const s = await queryOne<ServerRecord>(
    `INSERT INTO servers
       (name, country, country_id, city, flag, host, port, wg_host, wg_port, wg_password, max_users, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      data.name, data.country, data.country_id ?? null,
      data.city ?? null, data.flag ?? null,
      data.host, data.port ?? 51821,
      data.wg_host, data.wg_port ?? 51830,
      encryptPw(data.wg_password ?? null),
      data.max_users ?? 100,
      data.description ?? null,
    ]
  );
  if (!s) throw new Error('Server creation failed');
  return { ...s, wg_password: decryptPw(s.wg_password) };
}

export async function updateServer(
  id: string,
  data: Partial<ServerRecord>
): Promise<ServerRecord> {
  const patchData: Partial<ServerRecord> = { ...data };
  if (patchData.wg_password !== undefined) {
    patchData.wg_password = encryptPw(patchData.wg_password);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patchData)) {
    if (['id', 'created_at', 'current_users'].includes(k)) continue;
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  if (!fields.length) throw new Error('Nothing to update');
  values.push(id);
  const s = await queryOne<ServerRecord>(
    `UPDATE servers SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  if (!s) throw new NotFoundError('Server');
  return { ...s, wg_password: decryptPw(s.wg_password) };
}

export async function deleteServer(id: string): Promise<void> {
  const [{ count }] = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM users WHERE server_id = $1', [id]
  );
  if (parseInt(count, 10) > 0) {
    throw new ConflictError('Server has active users. Reassign them before deleting.');
  }
  await query('DELETE FROM servers WHERE id = $1', [id]);
}

export async function checkServerHealth(s: ServerRecord): Promise<{ online: boolean; latency: number; peers: number }> {
  try {
    const wg = wgManager.getInstance({ url: `http://${s.host}:${s.port}`, password: s.wg_password ?? env.WGEASY_PASSWORD });
    const latency = await wg.pingLatency();
    if (latency < 0) {
      await query(`UPDATE servers SET status = 'offline', latency_ms = NULL WHERE id = $1`, [s.id]);
      return { online: false, latency: -1, peers: 0 };
    }
    const clients = await wg.listClients();
    const connected = clients.filter((c) => wg.isConnected(c)).length;
    await query(
      `UPDATE servers SET status = 'online', latency_ms = $1 WHERE id = $2`,
      [latency, s.id]
    );
    return { online: true, latency, peers: connected };
  } catch (err) {
    logger.warn('Server health check failed', { serverId: s.id, error: String(err) });
    await query(`UPDATE servers SET status = 'offline' WHERE id = $1`, [s.id]);
    return { online: false, latency: -1, peers: 0 };
  }
}

export async function getServerForUser(userId: string): Promise<ServerRecord | null> {
  const s = await queryOne<ServerRecord>(
    `SELECT s.* FROM servers s
     INNER JOIN users u ON u.server_id = s.id
     WHERE u.id = $1 AND s.is_active = TRUE`,
    [userId]
  );
  if (!s) return null;
  return { ...s, wg_password: decryptPw(s.wg_password) };
}

export async function getDefaultServer(): Promise<ServerRecord | null> {
  const s = await queryOne<ServerRecord>(
    `SELECT * FROM servers WHERE is_active = TRUE AND status = 'online' ORDER BY created_at LIMIT 1`
  );
  if (!s) return null;
  return { ...s, wg_password: decryptPw(s.wg_password) };
}
