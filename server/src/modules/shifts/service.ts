import { query } from '../../config/database';
import * as cashService from '../cashRegister/service';

export async function getOpenByUser(userId: number) {
  const result = await query(`SELECT * FROM shifts WHERE user_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1`, [userId]);
  return result.rows[0] || null;
}

export async function getOpen() {
  const result = await query(`
    SELECT s.*, u.display_name, u.avatar_color, u.role
    FROM shifts s JOIN users u ON s.user_id = u.id
    WHERE s.status = 'open' ORDER BY s.opened_at
  `);
  return result.rows;
}

export async function open(userId: number, data: { starting_cash: number; notes?: string }) {
  const existing = await getOpenByUser(userId);
  if (existing) throw new Error('Ya tienes un turno abierto');

  const startingCash = data.starting_cash;

  // Auto-open cash register if none is open
  let register = await cashService.getOpen();
  if (!register) {
    register = await cashService.open(userId, startingCash);
  }

  const result = await query(
    'INSERT INTO shifts (user_id, register_id, starting_cash, notes) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, register.id, startingCash, data?.notes || null]
  );
  return result.rows[0];
}

export async function close(userId: number) {
  const shift = await getOpenByUser(userId);
  if (!shift) throw new Error('No tienes turno abierto');

  const result = await query(
    `UPDATE shifts SET status = 'closed', closed_at = NOW() WHERE id = $1 RETURNING *`,
    [shift.id]
  );

  // If no other open shifts remain, auto-close the cash register
  const remaining = await query(`SELECT COUNT(*) as count FROM shifts WHERE status = 'open'`);
  if (parseInt(remaining.rows[0].count) === 0) {
    const register = await cashService.getOpen();
    if (register) {
      // Close with expected amount (actual count can be done in Corte Z)
      await cashService.close(userId, 0, 'Cierre automático al cerrar último turno');
    }
  }

  return result.rows[0];
}

export async function getHistory(limit = 50) {
  const result = await query(`
    SELECT s.*, u.display_name
    FROM shifts s JOIN users u ON s.user_id = u.id
    ORDER BY s.opened_at DESC LIMIT $1
  `, [limit]);
  return result.rows;
}
