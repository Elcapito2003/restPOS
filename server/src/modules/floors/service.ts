import { query } from '../../config/database';
import { getIO } from '../../config/socket';

export async function getAllFloors() {
  const result = await query('SELECT * FROM floors WHERE is_active = true ORDER BY sort_order');
  return result.rows;
}

export async function createFloor(data: { name: string; sort_order?: number }) {
  const result = await query('INSERT INTO floors (name, sort_order) VALUES ($1, $2) RETURNING *', [data.name, data.sort_order || 0]);
  return result.rows[0];
}

export async function updateFloor(id: number, data: Partial<{ name: string; sort_order: number }>) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(data.sort_order); }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await query(`UPDATE floors SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
  return result.rows[0];
}

export async function deleteFloor(id: number) {
  await query('UPDATE floors SET is_active = false WHERE id = $1', [id]);
}

export async function getTablesByFloor(floorId: number) {
  const result = await query(`
    SELECT t.*, o.daily_number, o.waiter_id, u.display_name as waiter_name
    FROM tables t
    LEFT JOIN orders o ON t.current_order_id = o.id
    LEFT JOIN users u ON o.waiter_id = u.id
    WHERE t.floor_id = $1
    ORDER BY t.label
  `, [floorId]);
  return result.rows;
}

export async function createTable(data: any) {
  const result = await query(
    'INSERT INTO tables (floor_id, label, capacity, pos_x, pos_y, width, height, shape) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [data.floor_id, data.label, data.capacity || 4, data.pos_x || 0, data.pos_y || 0, data.width || 80, data.height || 80, data.shape || 'square']
  );
  return result.rows[0];
}

export async function updateTable(id: number, data: any) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const key of ['label', 'capacity', 'pos_x', 'pos_y', 'width', 'height', 'shape', 'floor_id']) {
    if (data[key] !== undefined) { fields.push(`${key} = $${idx++}`); values.push(data[key]); }
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await query(`UPDATE tables SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
  return result.rows[0];
}

export async function deleteTable(id: number) {
  await query('DELETE FROM tables WHERE id = $1', [id]);
}

export async function setTableStatus(id: number, status: string) {
  const result = await query('UPDATE tables SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
  const table = result.rows[0];
  if (table) {
    try { getIO().to(`floor:${table.floor_id}`).emit('table:status_changed', table); } catch {}
  }
  return table;
}

export async function transferTable(sourceId: number, targetId: number) {
  const source = await query('SELECT * FROM tables WHERE id = $1', [sourceId]);
  if (!source.rows[0]?.current_order_id) throw new Error('Mesa origen sin orden activa');

  const orderId = source.rows[0].current_order_id;
  await query('UPDATE orders SET table_id = $1 WHERE id = $2', [targetId, orderId]);
  await query('UPDATE tables SET current_order_id = $1, status = $2 WHERE id = $3', [orderId, 'occupied', targetId]);
  await query('UPDATE tables SET current_order_id = NULL, status = $1 WHERE id = $2', ['free', sourceId]);

  try {
    const io = getIO();
    const updatedSource = (await query('SELECT * FROM tables WHERE id = $1', [sourceId])).rows[0];
    const updatedTarget = (await query('SELECT * FROM tables WHERE id = $1', [targetId])).rows[0];
    io.to(`floor:${updatedSource.floor_id}`).emit('table:status_changed', updatedSource);
    io.to(`floor:${updatedTarget.floor_id}`).emit('table:status_changed', updatedTarget);
  } catch {}
}
