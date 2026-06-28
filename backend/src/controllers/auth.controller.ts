import { Request, Response, NextFunction } from 'express';
import { findByEmail, verifyPassword, findById, changePassword, toPublicUser } from '../services/user.service';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt';
import { logAction } from '../services/audit.service';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { validationResult } from 'express-validator';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new ValidationError(errors.array()[0].msg));

    const { email, password } = req.body;
    const user = await findByEmail(email);
    if (!user || !(await verifyPassword(user, password))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status === 'suspended') {
      throw new UnauthorizedError('Account suspended. Contact support.');
    }

    const payload = { userId: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await logAction('auth.login', {
      userId: user.id,
      actorId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: toPublicUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new UnauthorizedError('Refresh token required');

    const payload = verifyToken(refreshToken);
    const user = await findById(payload.userId);
    if (!user) throw new UnauthorizedError('User not found');

    const newPayload = { userId: user.id, role: user.role, email: user.email };
    res.json({
      success: true,
      data: { accessToken: signAccessToken(newPayload) },
    });
  } catch {
    next(new UnauthorizedError('Invalid refresh token'));
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await findById(req.user!.userId);
    if (!user) throw new UnauthorizedError();
    res.json({ success: true, data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new ValidationError(errors.array()[0].msg));

    const { current_password, new_password } = req.body;
    const user = await findById(req.user!.userId);
    if (!user) throw new UnauthorizedError();

    if (!(await verifyPassword(user, current_password))) {
      throw new UnauthorizedError('Current password incorrect');
    }

    await changePassword(user.id, new_password);
    await logAction('auth.password_changed', { userId: user.id, actorId: user.id, ipAddress: req.ip });

    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}
