import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import * as ctrl from '../controllers/settings.controller';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', ctrl.getAll);
router.put('/', ctrl.updateSettings);

export default router;
