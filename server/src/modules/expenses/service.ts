import { query } from '../../config/database';

export async function getTypes() {
  const result = await query('SELECT * FROM expense_types WHERE is_active = true ORDER BY name');
  return result.rows;
}

export async function createType(data: { name: string; parent_id?: number | null }) {
  const result = await query('INSERT INTO expense_types (name, parent_id) VALUES ($1, $2) RETURNING *', [data.name, data.parent_id || null]);
  return result.rows[0];
}

export async function getExpenses(startDate: string, endDate: string) {
  const result = await query(`
    SELECT e.*, et.name as type_name, u.display_name
    FROM expenses e
    JOIN expense_types et ON e.expense_type_id = et.id
    JOIN users u ON e.user_id = u.id
    WHERE DATE(e.created_at) BETWEEN $1 AND $2
    ORDER BY e.created_at DESC
  `, [startDate, endDate]);
  return result.rows;
}

export async function create(userId: number, data: { expense_type_id: number; amount: number; description?: string }) {
  const register = await query(`SELECT id FROM cash_registers WHERE status = 'open' LIMIT 1`);
  const registerId = register.rows[0]?.id || null;
  const result = await query(
    'INSERT INTO expenses (expense_type_id, amount, description, user_id, register_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [data.expense_type_id, data.amount, data.description || null, userId, registerId]
  );
  return result.rows[0];
}

export async function getSummary(startDate: string, endDate: string) {
  const result = await query(`
    SELECT et.name as type_name, COUNT(*) as count, COALESCE(SUM(e.amount), 0) as total
    FROM expenses e JOIN expense_types et ON e.expense_type_id = et.id
    WHERE DATE(e.created_at) BETWEEN $1 AND $2
    GROUP BY et.name ORDER BY total DESC
  `, [startDate, endDate]);
  return result.rows;
}
