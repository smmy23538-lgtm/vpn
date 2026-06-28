import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { status, downloadConfig, changeServer } from '../controllers/vpn.controller';

const router = Router();

router.use(authenticate);

router.get('/status', status);
router.get('/config', downloadConfig);
router.put('/server', changeServer);

export default router;
