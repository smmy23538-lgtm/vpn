import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import {
  createUser,
  updateUser,
  findById,
  listUsers,
  getDashboardStats,
  toPublicUser,
  renewSubscription,
} from '../services/user.service';
import {
  provisionVpnPeer,
  removeVpnPeer,
  enableVpnAccess,
  disableVpnAccess,
  getConnectedUsers,
} from '../services/vpn.service';
import { getAuditLogs } from '../services/audit.service';
import { logAction } from '../services/audit.service';
import { wgEasyService } from '../services/wgeasy.service';
import { NotFoundError, ValidationError } from '../utils/errors';
import { env } from '../config/env';
import os from 'os';

export async function dashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getDashboardStats();
    const onlineList = await getConnectedUsers();
    const online_users = onlineList.filter((u) => u.connected).length;

    res.json({ success: true, data: { ...stats, online_users } });
  } catch (err) {
    next(err);
  }
}

export async function serverHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wgClients = await wgEasyService.listClients();
    const connected_peers = wgClients.filter((c) => wgEasyService.isConnected(c)).length;

    const cpuUsage = process.cpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    res.json({
      success: true,
      data: {
        status: 'online',
        server_host: env.VPN_SERVER_HOST,
        server_name: env.VPN_SERVER_NAME,
        connected_peers,
        total_peers: wgClients.filter((c) => c.enabled).length,
        uptime_seconds: process.uptime(),
        memory_percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        cpu_user: cpuUsage.user,
        cpu_system: cpuUsage.system,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await listUsers(page, limit, search, status as never);
    res.json({
      success: true,
      data: {
        ...result,
        page,
        limit,
        pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await findById(req.params.id);
    if (!user) throw new NotFoundError('User');
    res.json({ success: true, data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function createNewUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new ValidationError(errors.array()[0].msg));

    const { email, password, full_name, activation_date, expiration_date } = req.body;

    let user = await createUser({
      email,
      password,
      full_name,
      role: 'customer',
      activation_date: new Date(activation_date),
      expiration_date: new Date(expiration_date),
      created_by: req.user!.userId,
    });

    user = await provisionVpnPeer(user, req.user!.userId);

    await logAction('admin.user.created', {
      userId: user.id,
      actorId: req.user!.userId,
      ipAddress: req.ip,
      details: { email, full_name },
    });

    res.status(201).json({ success: true, data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function editUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new ValidationError(errors.array()[0].msg));

    const user = await findById(req.params.id);
    if (!user) throw new NotFoundError('User');

    const { full_name, email, activation_date, expiration_date } = req.body;
    const updates: Parameters<typeof updateUser>[1] = {};
    if (full_name) updates.full_name = full_name;
    if (email) updates.email = email;
    if (activation_date) updates.activation_date = new Date(activation_date);
    if (expiration_date) updates.expiration_date = new Date(expiration_date);

    const updated = await updateUser(user.id, updates);

    await logAction('admin.user.edited', {
      userId: user.id,
      actorId: req.user!.userId,
      ipAddress: req.ip,
      details: updates,
    });

    res.json({ success: true, data: toPublicUser(updated) });
  } catch (err) {
    next(err);
  }
}

export async function suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await findById(req.params.id);
    if (!user) throw new NotFoundError('User');

    await disableVpnAccess(user.id, req.user!.userId);
    const updated = await updateUser(user.id, { status: 'suspended' });

    await logAction('admin.user.suspended', {
      userId: user.id,
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: toPublicUser(updated) });
  } catch (err) {
    next(err);
  }
}

export async function reactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await findById(req.params.id);
    if (!user) throw new NotFoundError('User');

    const updated = await updateUser(user.id, { status: 'active' });
    if (user.wg_client_id) await enableVpnAccess(user.id, req.user!.userId);

    await logAction('admin.user.reactivated', {
      userId: user.id,
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: toPublicUser(updated) });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await findById(req.params.id);
    if (!user) throw new NotFoundError('User');

    await removeVpnPeer(user.id, req.user!.userId);

    await logAction('admin.user.deleted', {
      userId: user.id,
      actorId: req.user!.userId,
      ipAddress: req.ip,
      details: { email: user.email },
    });

    const { query } = await import('../config/database');
    await query('DELETE FROM users WHERE id = $1', [user.id]);

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

export async function renewUserSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new ValidationError(errors.array()[0].msg));

    const { days } = req.body;
    const user = await findById(req.params.id);
    if (!user) throw new NotFoundError('User');

    const updated = await renewSubscription(user.id, parseInt(days, 10));
    if (user.wg_client_id) await enableVpnAccess(user.id, req.user!.userId);

    await logAction('admin.user.renewed', {
      userId: user.id,
      actorId: req.user!.userId,
      ipAddress: req.ip,
      details: { days, new_expiry: updated.expiration_date },
    });

    res.json({ success: true, data: toPublicUser(updated) });
  } catch (err) {
    next(err);
  }
}

export async function auditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    const userId = req.query.userId as string | undefined;

    const result = await getAuditLogs(page, limit, userId);
    res.json({
      success: true,
      data: {
        ...result,
        page,
        limit,
        pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function connectedPeers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await getConnectedUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}
