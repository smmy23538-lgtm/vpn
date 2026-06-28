import { Request, Response, NextFunction } from 'express';
import {
  getVpnStatus,
  getClientConfig,
  getConnectedUsers,
} from '../services/vpn.service';
import { findById } from '../services/user.service';
import { NotFoundError } from '../utils/errors';

export async function status(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vpnStatus = await getVpnStatus(req.user!.userId);
    res.json({ success: true, data: vpnStatus });
  } catch (err) {
    next(err);
  }
}

export async function downloadConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await findById(req.user!.userId);
    if (!user) throw new NotFoundError('User');

    const config = await getClientConfig(user.id);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${user.email}-vpn.conf"`);
    res.send(config);
  } catch (err) {
    next(err);
  }
}

export async function connectedUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await getConnectedUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}
