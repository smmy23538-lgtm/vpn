import { query } from '../config/database';
import { AuditLog } from '../types';
import { logger } from '../utils/logger';

export async function logAction(
  action: string,
  options: {
    userId?: string | null;
    actorId?: string | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
  } = {}
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, actor_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        options.userId ?? null,
        options.actorId ?? null,
        action,
        options.details ? JSON.stringify(options.details) : null,
        options.ipAddress ?? null,
      ]
    );
  } catch (err) {
    logger.error('Failed to write audit log', { action, error: String(err) });
  }
}

export async function getAuditLogs(
  page: number,
  limit: number,
  userId?: string
): Promise<{ items: AuditLog[]; total: number }> {
  const offset = (page - 1) * limit;
  const where = userId ? 'WHERE al.user_id = $3 OR al.actor_id = $3' : '';
  const params: unknown[] = [limit, offset];
  if (userId) params.push(userId);

  const items = await query<AuditLog>(
    `SELECT al.*,
            u.email as user_email,
            a.email as actor_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     LEFT JOIN users a ON al.actor_id = a.id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );

  const countParams: unknown[] = [];
  if (userId) countParams.push(userId);
  const countWhere = userId ? 'WHERE user_id = $1 OR actor_id = $1' : '';
  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs ${countWhere}`,
    countParams
  );

  return { items, total: parseInt(count, 10) };
}
