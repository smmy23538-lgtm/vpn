import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import * as ctrl from '../controllers/server.controller';

const router = Router();

// Public — users need to see available servers
router.get('/', authenticate, ctrl.list);

// Admin only
router.get('/health', authenticate, requireAdmin, ctrl.allHealth);
router.get('/:id', authenticate, requireAdmin, ctrl.get);
router.get('/:id/health', authenticate, requireAdmin, ctrl.health);
router.post(
  '/',
  authenticate, requireAdmin,
  [
    body('name').notEmpty().trim(),
    body('country').notEmpty().trim(),
    body('host').notEmpty().trim(),
    body('wg_host').notEmpty().trim(),
  ],
  ctrl.create
);
router.put('/:id', authenticate, requireAdmin, ctrl.update);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

export default router;
