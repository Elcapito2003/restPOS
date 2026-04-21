import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../../config/database';
import { env } from '../../config/env';
import { JwtPayload } from '../../types';

// ─── Account Lockout ───

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkLockout(key: string) {
  const record = failedAttempts.get(key);
  if (!record) return;

  if (record.lockedUntil > Date.now()) {
    const remaining = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    throw new Error(`Cuenta bloqueada. Intenta en ${remaining} minuto${remaining !== 1 ? 's' : ''}.`);
  }

  // Lockout expired, reset
  if (record.lockedUntil <= Date.now()) {
    failedAttempts.delete(key);
  }
}

function recordFailedAttempt(key: string) {
  const record = failedAttempts.get(key) || { count: 0, lockedUntil: 0 };
  record.count++;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
    console.warn(`[security] Account locked: ${key} after ${record.count} failed attempts`);
  }

  failedAttempts.set(key, record);
}

function clearFailedAttempts(key: string) {
  failedAttempts.delete(key);
}

// Clean up old entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedAttempts) {
    if (record.lockedUntil > 0 && record.lockedUntil <= now) {
      failedAttempts.delete(key);
    }
  }
}, 30 * 60 * 1000);

// ─── Auth Functions ───

export async function authenticateByPin(userId: number, pin: string, tenantId?: string) {
  const lockKey = `pin:${tenantId || 'legacy'}:${userId}`;
  checkLockout(lockKey);

  const result = await query('SELECT id, username, display_name, pin, role, avatar_color FROM users WHERE id = $1 AND is_active = true', [userId]);
  if (result.rows.length === 0) {
    recordFailedAttempt(lockKey);
    throw new Error('Usuario no encontrado');
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(pin, user.pin);
  if (!valid) {
    recordFailedAttempt(lockKey);
    throw new Error('PIN incorrecto');
  }

  clearFailedAttempts(lockKey);

  const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role, ...(tenantId ? { tenantId } : {}) };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '12h' as any });

  return {
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, avatar_color: user.avatar_color },
  };
}

export async function authenticateByUsername(username: string, pin: string, tenantId?: string) {
  const lockKey = `user:${tenantId || 'legacy'}:${username.toLowerCase()}`;
  checkLockout(lockKey);

  const result = await query('SELECT id, username, display_name, pin, role, avatar_color FROM users WHERE username = $1 AND is_active = true', [username]);
  if (result.rows.length === 0) {
    recordFailedAttempt(lockKey);
    throw new Error('Credenciales incorrectas');
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(pin, user.pin);
  if (!valid) {
    recordFailedAttempt(lockKey);
    throw new Error('Credenciales incorrectas');
  }

  clearFailedAttempts(lockKey);

  const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role, ...(tenantId ? { tenantId } : {}) };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '12h' as any });

  return {
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, avatar_color: user.avatar_color },
  };
}

export async function verifyPin(userId: number, pin: string) {
  const lockKey = `verify:${userId}`;
  checkLockout(lockKey);

  const result = await query('SELECT id, username, display_name, pin, role, avatar_color FROM users WHERE id = $1 AND is_active = true', [userId]);
  if (result.rows.length === 0) {
    recordFailedAttempt(lockKey);
    throw new Error('Usuario no encontrado');
  }
  const user = result.rows[0];
  const valid = await bcrypt.compare(pin, user.pin);
  if (!valid) {
    recordFailedAttempt(lockKey);
    throw new Error('PIN incorrecto');
  }

  clearFailedAttempts(lockKey);
  return { id: user.id, username: user.username, display_name: user.display_name, role: user.role };
}

export async function getActiveUsers() {
  const result = await query('SELECT id, username, display_name, role, avatar_color FROM users WHERE is_active = true ORDER BY display_name');
  return result.rows;
}
