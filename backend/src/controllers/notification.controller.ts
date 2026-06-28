import { Request, Response, NextFunction } from 'express';
import {
  listNotifications, markRead, markAllRead,
  getUnreadCount, deleteOldNotifications,
} from '../services/notification.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(String(req.query.limit ?? '50'), 10);
    res.json({ success: true, data: await listNotifications(unreadOnly, limit) });
  } catch (err) { next(err); }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: { count: await getUnreadCount() } });
  } catch (err) { next(err); }
}

export async function read(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ids } = req.body;
    if (Array.isArray(ids)) await markRead(ids);
    else await markAllRead();
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function purge(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days = parseInt(String(req.query.days ?? '30'), 10);
    await deleteOldNotifications(days);
    res.json({ success: true, message: `Notifications older than ${days} days deleted` });
  } catch (err) { next(err); }
}
