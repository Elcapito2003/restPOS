import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../../config/database';
import { env } from '../../config/env';
import { JwtPayload } from '../../types';

export async function authenticateByPin(userId: number, pin: string) {
  const result = await query('SELECT id, username, display_name, pin, role, avatar_color FROM users WHERE id = $1 AND is_active = true', [userId]);
  if (result.rows.length === 0) throw new Error('Usuario no encontrado');

  const user = result.rows[0];
  const valid = await bcrypt.compare(pin, user.pin);
  if (!valid) throw new Error('PIN incorrecto');

  const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '12h' as any });

  return {
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, avatar_color: user.avatar_color },
  };
}

export async function authenticateByUsername(username: string, pin: string) {
  const result = await query('SELECT id, username, display_name, pin, role, avatar_color FROM users WHERE username = $1 AND is_active = true', [username]);
  if (result.rows.length === 0) throw new Error('Usuario no encontrado');

  const user = result.rows[0];
  const valid = await bcrypt.compare(pin, user.pin);
  if (!valid) throw new Error('PIN incorrecto');

  const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '12h' as any });

  return {
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, avatar_color: user.avatar_color },
  };
}

export async function verifyPin(userId: number, pin: string) {
  const result = await query('SELECT id, username, display_name, pin, role, avatar_color FROM users WHERE id = $1 AND is_active = true', [userId]);
  if (result.rows.length === 0) throw new Error('Usuario no encontrado');
  const user = result.rows[0];
  const valid = await bcrypt.compare(pin, user.pin);
  if (!valid) throw new Error('PIN incorrecto');
  return { id: user.id, username: user.username, display_name: user.display_name, role: user.role };
}

export async function getActiveUsers() {
  const result = await query('SELECT id, username, display_name, role, avatar_color FROM users WHERE is_active = true ORDER BY display_name');
  return result.rows;
}
