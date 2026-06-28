import { Router } from 'express';
import authRoutes from './auth.routes';
import vpnRoutes from './vpn.routes';
import adminRoutes from './admin.routes';
import serverRoutes from './server.routes';
import countryRoutes from './country.routes';
import analyticsRoutes from './analytics.routes';
import notificationRoutes from './notification.routes';
import settingsRoutes from './settings.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/vpn', vpnRoutes);
router.use('/admin', adminRoutes);
router.use('/servers', serverRoutes);
router.use('/countries', countryRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingsRoutes);

router.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

export default router;
