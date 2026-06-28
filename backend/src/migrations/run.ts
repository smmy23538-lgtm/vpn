import fs from 'fs';
import path from 'path';
import { pool, checkConnection } from '../config/database';
import { logger } from '../utils/logger';

async function runMigrations(): Promise<void> {
  await checkConnection();
  const client = await pool.connect();

  try {
    const migrationsDir = __dirname;
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      logger.info(`Running migration: ${file}`);
      await client.query(sql);
      logger.info(`Migration done: ${file}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  logger.error('Migration failed', { error: String(err) });
  process.exit(1);
});
