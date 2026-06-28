import { Request, Response, NextFunction } from 'express';
import { getAnalytics, getBandwidthHistory } from '../services/analytics.service';
import { getConnectedUsers } from '../services/vpn.service';

export async function summary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days = parseInt(String(req.query.days ?? '30'), 10);
    res.json({ success: true, data: await getAnalytics(days) });
  } catch (err) { next(err); }
}

export async function bandwidth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const hours = parseInt(String(req.query.hours ?? '24'), 10);
    const serverId = req.query.serverId as string | undefined;
    res.json({ success: true, data: await getBandwidthHistory(serverId ?? null, hours) });
  } catch (err) { next(err); }
}

export async function liveConnections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await getConnectedUsers() });
  } catch (err) { next(err); }
}
