import { query } from '../../config/database';

export async function getAll() {
  const result = await query('SELECT * FROM clients WHERE is_active = true ORDER BY name');
  return result.rows;
}

export async function getById(id: number) {
  const result = await query('SELECT * FROM clients WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function search(term: string) {
  const result = await query(
    `SELECT * FROM clients WHERE is_active = true AND (name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1) ORDER BY name LIMIT 20`,
    [`%${term}%`]
  );
  return result.rows;
}

export async function create(data: any) {
  const result = await query(
    `INSERT INTO clients (name, phone, email, address, tax_id, client_type, credit_limit, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [data.name, data.phone || null, data.email || null, data.address || null, data.tax_id || null, data.client_type || 'general', data.credit_limit || 0, data.notes || null]
  );
  return result.rows[0];
}

export async function update(id: number, data: any) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const key of ['name','phone','email','address','tax_id','client_type','credit_limit','notes']) {
    if (data[key] !== undefined) { fields.push(`${key} = $${idx++}`); values.push(data[key]); }
  }
  if (fields.length === 0) return getById(id);
  values.push(id);
  const result = await query(`UPDATE clients SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
  return result.rows[0];
}

export async function remove(id: number) {
  await query('UPDATE clients SET is_active = false WHERE id = $1', [id]);
}
