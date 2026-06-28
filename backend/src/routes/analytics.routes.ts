import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import * as ctrl from '../controllers/analytics.controller';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/summary', ctrl.summary);
router.get('/bandwidth', ctrl.bandwidth);
router.get('/live', ctrl.liveConnections);

export default router;
