import dotenv from 'dotenv';
dotenv.config();

function require(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3001', 10),

  DATABASE_URL: require('DATABASE_URL'),

  JWT_SECRET: require('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',

  ENCRYPTION_KEY: require('ENCRYPTION_KEY'),

  WGEASY_URL: process.env.WGEASY_URL ?? 'http://3.21.126.65:51821',
  WGEASY_PASSWORD: require('WGEASY_PASSWORD'),

  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),

  VPN_SUBNET: process.env.VPN_SUBNET ?? '10.8.0.0/24',
  VPN_SERVER_HOST: process.env.VPN_SERVER_HOST ?? '3.21.126.65',
  VPN_SERVER_PORT: parseInt(process.env.VPN_SERVER_PORT ?? '51830', 10),
  VPN_SERVER_NAME: process.env.VPN_SERVER_NAME ?? 'US East',
  VPN_SERVER_COUNTRY: process.env.VPN_SERVER_COUNTRY ?? 'United States',

  EXPIRY_CHECK_CRON: process.env.EXPIRY_CHECK_CRON ?? '0 0 * * *',
  EXPIRY_WARNING_DAYS: parseInt(process.env.EXPIRY_WARNING_DAYS ?? '7', 10),
  ANALYTICS_SNAPSHOT_CRON: process.env.ANALYTICS_SNAPSHOT_CRON ?? '*/15 * * * *',

  APP_NAME: process.env.APP_NAME ?? 'SecureVPN',
};
