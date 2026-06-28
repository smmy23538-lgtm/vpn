import { query, queryOne } from '../config/database';

export interface Country {
  id: string;
  name: string;
  code: string;
  flag: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  server_count?: number;
}

export async function listCountries(activeOnly = false): Promise<Country[]> {
  const where = activeOnly ? 'WHERE c.is_active = TRUE' : '';
  return query<Country>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM servers s WHERE s.country_id = c.id AND s.is_active = TRUE)::int AS server_count
     FROM countries c ${where} ORDER BY c.sort_order, c.name`
  );
}

export async function createCountry(data: {
  name: string;
  code: string;
  flag?: string;
  sort_order?: number;
}): Promise<Country> {
  const c = await queryOne<Country>(
    `INSERT INTO countries (name, code, flag, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.name, data.code.toUpperCase(), data.flag ?? null, data.sort_order ?? 0]
  );
  if (!c) throw new Error('Country creation failed');
  return c;
}

export async function updateCountry(id: string, data: Partial<Country>): Promise<Country> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) {
    if (['id', 'created_at', 'server_count'].includes(k)) continue;
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  values.push(id);
  const c = await queryOne<Country>(
    `UPDATE countries SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  if (!c) throw new Error('Country not found');
  return c;
}

export async function deleteCountry(id: string): Promise<void> {
  await query('DELETE FROM countries WHERE id = $1', [id]);
}
