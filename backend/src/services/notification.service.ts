import { query } from '../config/database';
import { logger } from '../utils/logger';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  severity: NotificationSeverity;
  data: Record<string, unknown> | null;
  created_at: Date;
}

export async function createNotification(n: {
  type: string;
  title: string;
  message?: string;
  severity?: NotificationSeverity;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications (type, title, message, severity, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [n.type, n.title, n.message ?? null, n.severity ?? 'info', n.data ? JSON.stringify(n.data) : null]
    );
  } catch (err) {
    logger.error('Failed to create notification', { error: String(err) });
  }
}

export async function listNotifications(
  unreadOnly = false,
  limit = 50
): Promise<Notification[]> {
  const where = unreadOnly ? 'WHERE is_read = FALSE' : '';
  return query<Notification>(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function markRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await query(
    `UPDATE notifications SET is_read = TRUE WHERE id = ANY($1::uuid[])`,
    [ids]
  );
}

export async function markAllRead(): Promise<void> {
  await query('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
}

export async function getUnreadCount(): Promise<number> {
  const [{ count }] = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM notifications WHERE is_read = FALSE'
  );
  return parseInt(count, 10);
}

export async function deleteOldNotifications(days = 30): Promise<void> {
  await query(
    `DELETE FROM notifications WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
    [days]
  );
}
