import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import {
  listServers, getServer, createServer, updateServer,
  deleteServer, checkServerHealth,
} from '../services/server.service';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logAction } from '../services/audit.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const servers = await listServers();
    // Customers must not see the wg_password (it's only needed server-side)
    const isAdmin = req.user?.role === 'admin';
    const data = isAdmin
      ? servers
      : servers.map(({ wg_password: _pw, ...rest }) => rest);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const s = await getServer(req.params.id);
    if (!s) throw new NotFoundError('Server');
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new ValidationError(errors.array()[0].msg));
    const s = await createServer(req.body);
    await logAction('admin.server.created', {
      actorId: req.user!.userId,
      ipAddress: req.ip,
      details: { name: s.name, host: s.host },
    });
    res.status(201).json({ success: true, data: s });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const s = await updateServer(req.params.id, req.body);
    await logAction('admin.server.updated', { actorId: req.user!.userId, ipAddress: req.ip, details: { id: s.id } });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteServer(req.params.id);
    await logAction('admin.server.deleted', { actorId: req.user!.userId, ipAddress: req.ip, details: { id: req.params.id } });
    res.json({ success: true, message: 'Server deleted' });
  } catch (err) { next(err); }
}

export async function health(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const s = await getServer(req.params.id);
    if (!s) throw new NotFoundError('Server');
    const result = await checkServerHealth(s);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function allHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const servers = await listServers();
    const results = await Promise.all(servers.map(async (s) => ({
      ...s,
      ...(await checkServerHealth(s)),
    })));
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
}
