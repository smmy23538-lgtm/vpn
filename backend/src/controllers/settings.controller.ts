import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { logAction } from '../services/audit.service';

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await query<{ key: string; value: string; label: string; group_name: string }>(
      'SELECT key, value, label, group_name FROM settings ORDER BY group_name, key'
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      await query(
        `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2`,
        [String(value), key]
      );
    }
    await logAction('admin.settings.updated', {
      actorId: req.user!.userId,
      ipAddress: req.ip,
      details: { keys: Object.keys(updates) },
    });
    res.json({ success: true, message: 'Settings saved' });
  } catch (err) { next(err); }
}
