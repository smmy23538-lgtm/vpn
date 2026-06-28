import cron from 'node-cron';
import { query } from '../config/database';
import { disableVpnAccess } from './vpn.service';
import { logAction } from './audit.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { User } from '../types';

async function runExpirationCheck(): Promise<void> {
  logger.info('Scheduler: running expiration check');

  const expired = await query<User>(
    `SELECT * FROM users
     WHERE role = 'customer'
       AND status = 'active'
       AND expiration_date < NOW()`
  );

  for (const user of expired) {
    try {
      if (user.wg_client_id) {
        await disableVpnAccess(user.id, 'system');
      }
      await query(
        `UPDATE users SET status = 'expired', updated_at = NOW() WHERE id = $1`,
        [user.id]
      );
      await logAction('system.subscription.expired', {
        userId: user.id,
        details: { email: user.email, expired_at: user.expiration_date },
      });
      logger.info('Scheduler: expired user', { email: user.email });
    } catch (err) {
      logger.error('Scheduler: failed to expire user', { email: user.email, error: String(err) });
    }
  }

  logger.info(`Scheduler: expiration check done — ${expired.length} user(s) expired`);
}

async function runExpiryWarnings(): Promise<void> {
  const warning = await query<User>(
    `SELECT * FROM users
     WHERE role = 'customer'
       AND status = 'active'
       AND expiration_date BETWEEN NOW() AND NOW() + INTERVAL '${env.EXPIRY_WARNING_DAYS} days'`
  );

  for (const user of warning) {
    await logAction('system.subscription.expiring_soon', {
      userId: user.id,
      details: { email: user.email, expiration_date: user.expiration_date },
    });
  }

  if (warning.length > 0) {
    logger.info(`Scheduler: ${warning.length} user(s) expiring within ${env.EXPIRY_WARNING_DAYS} days`);
  }
}

export function startScheduler(): void {
  cron.schedule(env.EXPIRY_CHECK_CRON, async () => {
    await runExpirationCheck();
    await runExpiryWarnings();
  });

  logger.info(`Scheduler: started, cron="${env.EXPIRY_CHECK_CRON}"`);
}
