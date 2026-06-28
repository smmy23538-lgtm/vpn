import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Missing token');
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
