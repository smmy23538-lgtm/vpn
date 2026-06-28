import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import {
  dashboardStats,
  serverHealth,
  listAllUsers,
  getUser,
  createNewUser,
  editUser,
  suspendUser,
  reactivateUser,
  deleteUser,
  renewUserSubscription,
  auditLogs,
  connectedPeers,
} from '../controllers/admin.controller';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/stats', dashboardStats);
router.get('/health', serverHealth);
router.get('/connected', connectedPeers);

router.get('/users', listAllUsers);
router.get('/users/:id', getUser);
router.post(
  '/users',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('full_name').notEmpty().trim(),
    body('activation_date').isISO8601(),
    body('expiration_date').isISO8601(),
  ],
  createNewUser
);
router.put('/users/:id', editUser);
router.post('/users/:id/suspend', suspendUser);
router.post('/users/:id/reactivate', reactivateUser);
router.delete('/users/:id', deleteUser);
router.post(
  '/users/:id/renew',
  [body('days').isInt({ min: 1 }).withMessage('Days must be a positive integer')],
  renewUserSubscription
);

router.get('/audit-logs', auditLogs);

export default router;
