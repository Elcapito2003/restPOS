import bcrypt from 'bcrypt';
import { query } from '../../config/database';
import { emitToUser } from '../../config/socket';

export async function getAll() {
  const result = await query('SELECT id, username, display_name, role, avatar_color, is_active, created_at FROM users ORDER BY display_name');
  return result.rows;
}

export async function getById(id: number) {
  const result = await query('SELECT id, username, display_name, role, avatar_color, is_active, created_at FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function create(data: { username: string; display_name: string; pin: string; role: string; avatar_color?: string }) {
  const hashedPin = await bcrypt.hash(data.pin, 10);
  const result = await query(
    'INSERT INTO users (username, display_name, pin, role, avatar_color) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, display_name, role, avatar_color',
    [data.username, data.display_name, hashedPin, data.role, data.avatar_color || '#3B82F6']
  );
  return result.rows[0];
}

export async function update(id: number, data: Partial<{ username: string; display_name: string; pin: string; role: string; avatar_color: string; is_active: boolean }>) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.username) { fields.push(`username = $${idx++}`); values.push(data.username); }
  if (data.display_name) { fields.push(`display_name = $${idx++}`); values.push(data.display_name); }
  if (data.pin) { const h = await bcrypt.hash(data.pin, 10); fields.push(`pin = $${idx++}`); values.push(h); }
  if (data.role) { fields.push(`role = $${idx++}`); values.push(data.role); }
  if (data.avatar_color) { fields.push(`avatar_color = $${idx++}`); values.push(data.avatar_color); }
  if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }

  if (fields.length === 0) return getById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, username, display_name, role, avatar_color, is_active`,
    values
  );
  if (data.is_active === false) {
    emitToUser(id, 'user:deactivated', { userId: id, reason: 'deactivated' });
  }
  return result.rows[0];
}

export async function remove(id: number) {
  await query('UPDATE users SET is_active = false WHERE id = $1', [id]);
  emitToUser(id, 'user:deactivated', { userId: id, reason: 'removed' });
}

export async function setFingerprint(id: number, templateBase64: string) {
  await query(
    `UPDATE users SET fingerprint_template = $1, fingerprint_enrolled_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [templateBase64, id]
  );
  return getById(id);
}

export async function clearFingerprint(id: number) {
  await query(
    `UPDATE users SET fingerprint_template = NULL, fingerprint_enrolled_at = NULL, updated_at = NOW() WHERE id = $1`,
    [id]
  );
  return getById(id);
}

export async function getEnrollmentStatus() {
  const r = await query(`
    SELECT id, display_name, role, avatar_color, is_active,
           (fingerprint_template IS NOT NULL) AS has_fingerprint,
           fingerprint_enrolled_at
    FROM users WHERE is_active = true ORDER BY display_name
  `);
  return r.rows;
}
