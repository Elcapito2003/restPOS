import { query } from '../../config/database';

export async function getAll() {
  const result = await query('SELECT * FROM discount_presets ORDER BY name');
  return result.rows;
}

export async function getActive() {
  const result = await query('SELECT * FROM discount_presets WHERE is_active = true ORDER BY name');
  return result.rows;
}

export async function getById(id: number) {
  const result = await query('SELECT * FROM discount_presets WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function create(data: { name: string; code?: string | null; discount_percent: number; is_active?: boolean }, createdBy: number) {
  const result = await query(
    'INSERT INTO discount_presets (name, code, discount_percent, is_active, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [data.name, data.code || null, data.discount_percent, data.is_active !== false, createdBy]
  );
  return result.rows[0];
}

export async function update(id: number, data: { name?: string; code?: string | null; discount_percent?: number; is_active?: boolean }) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.code !== undefined) { fields.push(`code = $${idx++}`); values.push(data.code || null); }
  if (data.discount_percent !== undefined) { fields.push(`discount_percent = $${idx++}`); values.push(data.discount_percent); }
  if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }

  if (fields.length === 0) return getById(id);

  values.push(id);
  const result = await query(`UPDATE discount_presets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
  return result.rows[0];
}

export async function deactivate(id: number) {
  const result = await query('UPDATE discount_presets SET is_active = false WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}
