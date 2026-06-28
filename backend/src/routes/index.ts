import { Router } from 'express';
import authRoutes from './auth.routes';
import vpnRoutes from './vpn.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/vpn', vpnRoutes);
router.use('/admin', adminRoutes);

router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default router;
