import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import * as ctrl from '../controllers/notification.controller';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', ctrl.list);
router.get('/count', ctrl.unreadCount);
router.post('/read', ctrl.read);
router.delete('/purge', ctrl.purge);

export default router;
