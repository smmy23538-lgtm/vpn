import { Router } from 'express';
import { body } from 'express-validator';
import { login, refresh, me, updatePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().isLength({ min: 1 }),
  ],
  login
);

router.post('/refresh', refresh);
router.get('/me', authenticate, me);
router.put(
  '/password',
  authenticate,
  [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  updatePassword
);

export default router;
