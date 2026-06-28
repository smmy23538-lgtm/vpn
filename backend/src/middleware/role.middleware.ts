import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) return next(new ForbiddenError('Insufficient permissions'));
    next();
  };
}

export const requireAdmin = requireRole('admin');
