import cron from 'node-cron';
import { query } from '../config/database';
import { disableVpnAccess } from './vpn.service';
import { logAction } from './audit.service';
import { createNotification } from './notification.service';
import { takeAnalyticsSnapshot } from './analytics.service';
import { checkServerHealth, listServers } from './server.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { User } from '../types';

async function runExpirationCheck(): Promise<void> {
  logger.info('Scheduler: running expiration check');

  const expired = await query<User>(
    `SELECT * FROM users WHERE role = 'customer' AND status = 'active' AND expiration_date < NOW()`
  );

  for (const user of expired) {
    try {
      await disableVpnAccess(user.id, 'system');
      await query(`UPDATE users SET status = 'expired', updated_at = NOW() WHERE id = $1`, [user.id]);
      await logAction('system.subscription.expired', {
        userId: user.id,
        details: { email: user.email, expired_at: user.expiration_date },
      });
      await createNotification({
        type: 'subscription.expired',
        title: 'User subscription expired',
        message: `${user.email}'s subscription has expired and VPN access was revoked.`,
        severity: 'warning',
        data: { userId: user.id, email: user.email },
      });
    } catch (err) {
      logger.error('Scheduler: failed to expire user', { email: user.email, error: String(err) });
    }
  }

  if (expired.length > 0) {
    logger.info(`Scheduler: expired ${expired.length} user(s)`);
  }
}

async function runExpiryWarnings(): Promise<void> {
  const warning = await query<User>(
    `SELECT * FROM users
     WHERE role = 'customer' AND status = 'active'
       AND expiration_date BETWEEN NOW() AND NOW() + INTERVAL '${env.EXPIRY_WARNING_DAYS} days'`
  );

  for (const user of warning) {
    const days = Math.ceil((new Date(user.expiration_date).getTime() - Date.now()) / 86400000);
    await logAction('system.subscription.expiring_soon', {
      userId: user.id,
      details: { email: user.email, expiration_date: user.expiration_date, days_left: days },
    });
  }

  if (warning.length > 0) {
    await createNotification({
      type: 'subscription.expiring_soon',
      title: `${warning.length} subscription(s) expiring soon`,
      message: `${warning.map((u) => u.email).join(', ')} will expire within ${env.EXPIRY_WARNING_DAYS} days.`,
      severity: 'info',
      data: { count: warning.length },
    });
  }
}

async function runServerHealthChecks(): Promise<void> {
  const servers = await listServers();
  for (const s of servers) {
    if (!s.is_active) continue;
    const { online } = await checkServerHealth(s);
    if (!online) {
      await createNotification({
        type: 'server.offline',
        title: `Server offline: ${s.name}`,
        message: `The VPN server "${s.name}" (${s.host}) is not responding.`,
        severity: 'error',
        data: { serverId: s.id, host: s.host },
      });
    }
  }
}

export function startScheduler(): void {
  // Daily expiration check at midnight
  cron.schedule(env.EXPIRY_CHECK_CRON, async () => {
    await runExpirationCheck();
    await runExpiryWarnings();
  });

  // Server health check every 5 minutes
  cron.schedule('*/5 * * * *', runServerHealthChecks);

  // Analytics snapshot every 15 minutes
  cron.schedule(env.ANALYTICS_SNAPSHOT_CRON, takeAnalyticsSnapshot);

  logger.info('Scheduler: started all jobs');
}
