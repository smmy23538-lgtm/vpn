import bcrypt from 'bcrypt';
import { query, queryOne } from '../config/database';
import { User, PublicUser, UserStatus } from '../types';
import { ConflictError, NotFoundError } from '../utils/errors';

const SALT_ROUNDS = 12;

export function toPublicUser(u: User): PublicUser {
  const { password_hash: _, wg_private_key: __, wg_preshared_key: ___, ...pub } = u;
  return pub as PublicUser;
}

export async function findById(id: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function findByEmail(email: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
}

export async function createUser(data: {
  email: string;
  password: string;
  full_name: string;
  role?: 'admin' | 'customer';
  activation_date: Date;
  expiration_date: Date;
  created_by?: string;
}): Promise<User> {
  const existing = await findByEmail(data.email);
  if (existing) throw new ConflictError('Email already registered');

  const password_hash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await queryOne<User>(
    `INSERT INTO users (email, password_hash, full_name, role, activation_date, expiration_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.email.toLowerCase(),
      password_hash,
      data.full_name,
      data.role ?? 'customer',
      data.activation_date,
      data.expiration_date,
      data.created_by ?? null,
    ]
  );
  if (!user) throw new Error('User creation failed');
  return user;
}

export async function updateUser(
  id: string,
  data: Partial<{
    email: string;
    full_name: string;
    status: UserStatus;
    activation_date: Date;
    expiration_date: Date;
    wg_client_id: string | null;
    wg_client_ip: string | null;
    wg_public_key: string | null;
    wg_private_key: string | null;
    wg_preshared_key: string | null;
  }>
): Promise<User> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const [key, value] of Object.entries(data)) {
    fields.push(`${key} = $${i++}`);
    values.push(value);
  }
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const user = await queryOne<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

export async function changePassword(userId: string, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
    hash,
    userId,
  ]);
}

export async function listUsers(
  page: number,
  limit: number,
  search?: string,
  status?: UserStatus
): Promise<{ items: PublicUser[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = ["role = 'customer'"];
  const params: unknown[] = [limit, offset];
  let i = 3;

  if (search) {
    conditions.push(`(email ILIKE $${i} OR full_name ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }
  if (status) {
    conditions.push(`status = $${i}`);
    params.push(status);
    i++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const items = await query<User>(
    `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    params
  );

  const countParams = params.slice(2);
  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM users ${where}`,
    countParams
  );

  return { items: items.map(toPublicUser), total: parseInt(count, 10) };
}

export async function getDashboardStats(): Promise<{
  total_users: number;
  active_users: number;
  expired_users: number;
  suspended_users: number;
  expiring_soon: number;
}> {
  const [stats] = await query<{
    total_users: string;
    active_users: string;
    expired_users: string;
    suspended_users: string;
    expiring_soon: string;
  }>(
    `SELECT
       COUNT(*)                                                             AS total_users,
       COUNT(*) FILTER (WHERE status = 'active')                           AS active_users,
       COUNT(*) FILTER (WHERE status = 'expired')                          AS expired_users,
       COUNT(*) FILTER (WHERE status = 'suspended')                        AS suspended_users,
       COUNT(*) FILTER (WHERE status = 'active'
                          AND expiration_date BETWEEN NOW()
                          AND NOW() + INTERVAL '7 days')                   AS expiring_soon
     FROM users WHERE role = 'customer'`
  );

  return {
    total_users: parseInt(stats.total_users, 10),
    active_users: parseInt(stats.active_users, 10),
    expired_users: parseInt(stats.expired_users, 10),
    suspended_users: parseInt(stats.suspended_users, 10),
    expiring_soon: parseInt(stats.expiring_soon, 10),
  };
}

export async function renewSubscription(
  userId: string,
  days: number
): Promise<User> {
  const user = await findById(userId);
  if (!user) throw new NotFoundError('User');

  const base =
    user.expiration_date > new Date() ? user.expiration_date : new Date();
  const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  return updateUser(userId, {
    expiration_date: newExpiry,
    status: 'active',
  });
}
