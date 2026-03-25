import { query, getClient } from '../../config/database';
import { getIO } from '../../config/socket';
import { getNextDailyNumber } from '../../utils';
import { printComanda } from '../printer/service';

export async function getById(id: number) {
  const result = await query(`
    SELECT o.*, u.display_name as waiter_name, t.label as table_label
    FROM orders o
    LEFT JOIN users u ON o.waiter_id = u.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.id = $1
  `, [id]);
  if (result.rows.length === 0) return null;
  const order = result.rows[0];

  const items = await query(`
    SELECT oi.*, p.name as product_name_current
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = $1
    ORDER BY oi.created_at
  `, [id]);

  for (const item of items.rows) {
    const mods = await query('SELECT * FROM order_item_modifiers WHERE order_item_id = $1', [item.id]);
    item.modifiers = mods.rows;
  }

  order.items = items.rows;
  return order;
}

export async function getByTable(tableId: number) {
  const result = await query(`SELECT id FROM orders WHERE table_id = $1 AND status IN ('open','sent','partial') ORDER BY created_at DESC LIMIT 1`, [tableId]);
  if (result.rows.length === 0) return null;
  return getById(result.rows[0].id);
}

export async function getActive() {
  const result = await query(`
    SELECT o.*, u.display_name as waiter_name, t.label as table_label
    FROM orders o
    LEFT JOIN users u ON o.waiter_id = u.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('open','sent','partial')
    ORDER BY o.created_at DESC
  `);
  return result.rows;
}

export async function create(waiterId: number, data: { table_id?: number | null; order_type?: string; guest_count?: number; notes?: string }) {
  const dailyNumber = await getNextDailyNumber();
  const orderType = data.order_type || (data.table_id ? 'dine_in' : 'quick');
  const result = await query(
    'INSERT INTO orders (daily_number, table_id, waiter_id, guest_count, notes, order_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [dailyNumber, data.table_id || null, waiterId, data.guest_count || 1, data.notes || null, orderType]
  );
  const order = result.rows[0];

  if (data.table_id) {
    await query('UPDATE tables SET status = $1, current_order_id = $2 WHERE id = $3', ['occupied', order.id, data.table_id]);
    try {
      const table = (await query('SELECT * FROM tables WHERE id = $1', [data.table_id])).rows[0];
      getIO().to(`floor:${table.floor_id}`).emit('table:status_changed', table);
    } catch {}
  }

  try { getIO().emit('order:created', order); } catch {}

  return getById(order.id);
}

export async function addItem(orderId: number, data: { product_id: number; quantity?: number; notes?: string; modifiers?: { modifier_id: number }[] }) {
  const product = await query('SELECT p.*, c.printer_target FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = $1', [data.product_id]);
  if (product.rows.length === 0) throw new Error('Producto no encontrado');
  const p = product.rows[0];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query(
      'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, tax_rate, notes, printer_target) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [orderId, p.id, p.name, data.quantity || 1, p.price, p.tax_rate, data.notes || null, p.printer_target]
    );
    const item = itemResult.rows[0];

    if (data.modifiers?.length) {
      for (const mod of data.modifiers) {
        const modifier = await client.query('SELECT * FROM modifiers WHERE id = $1', [mod.modifier_id]);
        if (modifier.rows[0]) {
          await client.query(
            'INSERT INTO order_item_modifiers (order_item_id, modifier_id, modifier_name, price_extra) VALUES ($1,$2,$3,$4)',
            [item.id, modifier.rows[0].id, modifier.rows[0].name, modifier.rows[0].price_extra]
          );
        }
      }
    }

    await recalcTotals(client, orderId);
    await client.query('COMMIT');
    return getById(orderId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateItem(orderId: number, itemId: number, data: { quantity?: number; notes?: string; status?: string }) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.quantity !== undefined) { fields.push(`quantity = $${idx++}`); values.push(data.quantity); }
  if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }
  if (data.status) {
    fields.push(`status = $${idx++}`); values.push(data.status);
    if (data.status === 'sent') { fields.push(`sent_at = NOW()`); }
    if (data.status === 'ready') { fields.push(`ready_at = NOW()`); }
  }

  if (fields.length === 0) return getById(orderId);
  values.push(itemId);

  await query(`UPDATE order_items SET ${fields.join(', ')} WHERE id = $${idx}`, values);

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await recalcTotals(client, orderId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getById(orderId);
}

export async function removeItem(orderId: number, itemId: number) {
  await query('DELETE FROM order_items WHERE id = $1 AND order_id = $2', [itemId, orderId]);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await recalcTotals(client, orderId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getById(orderId);
}

export async function sendToKitchen(orderId: number) {
  await query(`UPDATE order_items SET status = 'sent', sent_at = NOW() WHERE order_id = $1 AND status = 'pending'`, [orderId]);
  await query(`UPDATE orders SET status = 'sent', updated_at = NOW() WHERE id = $1`, [orderId]);

  const order = await getById(orderId);
  try {
    getIO().to('kitchen').emit('order:sent', order);
    getIO().emit('order:updated', order);
  } catch {}

  // Auto-print comanda to kitchen/bar printers
  try {
    await printComanda(orderId);
  } catch (err) {
    console.error('[AUTO-PRINT] Error imprimiendo comanda:', err);
  }

  return order;
}

export async function setDiscount(orderId: number, discountPercent: number, presetId?: number | null, authorizedBy?: number | null) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE orders SET discount_percent = $1, discount_preset_id = $2, discount_authorized_by = $3 WHERE id = $4',
      [discountPercent, presetId || null, authorizedBy || null, orderId]
    );
    await recalcTotals(client, orderId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getById(orderId);
}

export async function cancelOrder(orderId: number) {
  const order = await getById(orderId);
  if (!order) throw new Error('Orden no encontrada');

  await query(`UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [orderId]);
  await query(`UPDATE order_items SET status = 'cancelled' WHERE order_id = $1`, [orderId]);

  if (order.table_id) {
    await query(`UPDATE tables SET status = 'free', current_order_id = NULL WHERE id = $1`, [order.table_id]);
    try {
      const table = (await query('SELECT * FROM tables WHERE id = $1', [order.table_id])).rows[0];
      getIO().to(`floor:${table.floor_id}`).emit('table:status_changed', table);
    } catch {}
  }

  try { getIO().emit('order:cancelled', { id: orderId }); } catch {}
  return getById(orderId);
}

async function recalcTotals(client: any, orderId: number) {
  const items = await client.query(`
    SELECT oi.unit_price, oi.quantity, oi.tax_rate,
      COALESCE(SUM(oim.price_extra), 0) as mod_extra
    FROM order_items oi
    LEFT JOIN order_item_modifiers oim ON oim.order_item_id = oi.id
    WHERE oi.order_id = $1 AND oi.status != 'cancelled'
    GROUP BY oi.id, oi.unit_price, oi.quantity, oi.tax_rate
  `, [orderId]);

  // Prices are IVA-included. Extract subtotal (without IVA) and tax from the total.
  let subtotal = 0;
  let tax = 0;
  for (const item of items.rows) {
    const lineTotal = (parseFloat(item.unit_price) + parseFloat(item.mod_extra)) * item.quantity;
    const taxRate = parseFloat(item.tax_rate);
    const lineSubtotal = taxRate > 0 ? lineTotal / (1 + taxRate) : lineTotal;
    const lineTax = lineTotal - lineSubtotal;
    subtotal += lineSubtotal;
    tax += lineTax;
  }

  const orderResult = await client.query('SELECT discount_percent, tip FROM orders WHERE id = $1', [orderId]);
  const discountPercent = parseFloat(orderResult.rows[0]?.discount_percent || '0');
  const tip = parseFloat(orderResult.rows[0]?.tip || '0');
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount + tax + tip;

  await client.query(
    'UPDATE orders SET subtotal=$1, tax=$2, discount_amount=$3, total=$4, updated_at=NOW() WHERE id=$5',
    [subtotal.toFixed(2), tax.toFixed(2), discountAmount.toFixed(2), total.toFixed(2), orderId]
  );
}

export async function getKitchenOrders() {
  const result = await query(`
    SELECT o.id, o.daily_number, o.table_id, t.label as table_label, o.created_at,
      json_agg(json_build_object(
        'id', oi.id, 'product_name', oi.product_name, 'quantity', oi.quantity,
        'notes', oi.notes, 'status', oi.status, 'sent_at', oi.sent_at,
        'printer_target', oi.printer_target
      ) ORDER BY oi.created_at) as items
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE oi.status IN ('sent', 'preparing')
    GROUP BY o.id, o.daily_number, o.table_id, t.label, o.created_at
    ORDER BY o.created_at
  `);
  return result.rows;
}

export async function markItemReady(itemId: number) {
  await query(`UPDATE order_items SET status = 'ready', ready_at = NOW() WHERE id = $1`, [itemId]);
  const item = (await query('SELECT * FROM order_items WHERE id = $1', [itemId])).rows[0];
  if (!item) return;

  // Check if all items in order are ready
  const pending = await query(`SELECT COUNT(*) FROM order_items WHERE order_id = $1 AND status IN ('sent','preparing')`, [item.order_id]);
  const allReady = parseInt(pending.rows[0].count) === 0;

  try {
    getIO().emit('kitchen:item_ready', { item_id: itemId, order_id: item.order_id });
    if (allReady) {
      getIO().emit('kitchen:order_ready', { order_id: item.order_id });
    }
  } catch {}

  return item;
}

export async function markItemPreparing(itemId: number) {
  await query(`UPDATE order_items SET status = 'preparing' WHERE id = $1`, [itemId]);
  try { getIO().to('kitchen').emit('kitchen:item_preparing', { item_id: itemId }); } catch {}
}

export async function cancelItem(orderId: number, itemId: number, reason: string, cancelledBy: number) {
  await query(`UPDATE order_items SET status = 'cancelled', cancel_reason = $1, cancelled_by = $2 WHERE id = $3 AND order_id = $4`,
    [reason, cancelledBy, itemId, orderId]);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await recalcTotals(client, orderId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getById(orderId);
}

export async function transferItems(fromOrderId: number, toOrderId: number, itemIds: number[]) {
  for (const itemId of itemIds) {
    await query('UPDATE order_items SET order_id = $1 WHERE id = $2 AND order_id = $3', [toOrderId, itemId, fromOrderId]);
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await recalcTotals(client, fromOrderId);
    await recalcTotals(client, toOrderId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { from: await getById(fromOrderId), to: await getById(toOrderId) };
}

export async function mergeOrders(sourceOrderId: number, targetOrderId: number) {
  await query('UPDATE order_items SET order_id = $1 WHERE order_id = $2 AND status != $3', [targetOrderId, sourceOrderId, 'cancelled']);
  await query(`UPDATE orders SET status = 'cancelled', notes = 'Juntada con orden #' || $1, updated_at = NOW() WHERE id = $2`, [targetOrderId, sourceOrderId]);

  const sourceOrder = await query('SELECT table_id FROM orders WHERE id = $1', [sourceOrderId]);
  if (sourceOrder.rows[0]?.table_id) {
    await query(`UPDATE tables SET status = 'free', current_order_id = NULL WHERE id = $1`, [sourceOrder.rows[0].table_id]);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await recalcTotals(client, targetOrderId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getById(targetOrderId);
}

export async function changeWaiter(orderId: number, newWaiterId: number) {
  await query('UPDATE orders SET waiter_id = $1, updated_at = NOW() WHERE id = $2', [newWaiterId, orderId]);
  return getById(orderId);
}

export async function changeTable(orderId: number, newTableId: number) {
  const order = await getById(orderId);
  if (!order) throw new Error('Orden no encontrada');

  // Free old table
  if (order.table_id) {
    await query(`UPDATE tables SET status = 'free', current_order_id = NULL WHERE id = $1`, [order.table_id]);
  }
  // Occupy new table
  await query(`UPDATE tables SET status = 'occupied', current_order_id = $1 WHERE id = $2`, [orderId, newTableId]);
  await query('UPDATE orders SET table_id = $1, updated_at = NOW() WHERE id = $2', [newTableId, orderId]);

  return getById(orderId);
}

export async function setTip(orderId: number, tipAmount: number) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE orders SET tip = $1 WHERE id = $2', [tipAmount, orderId]);
    await recalcTotals(client, orderId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getById(orderId);
}

export async function setObservations(orderId: number, notes: string) {
  await query('UPDATE orders SET notes = $1, updated_at = NOW() WHERE id = $2', [notes, orderId]);
  return getById(orderId);
}

export async function setGuestCount(orderId: number, guestCount: number) {
  await query('UPDATE orders SET guest_count = $1, updated_at = NOW() WHERE id = $2', [guestCount, orderId]);
  return getById(orderId);
}

export async function getCancellationReasons() {
  const result = await query('SELECT * FROM cancellation_reasons WHERE is_active = true ORDER BY name');
  return result.rows;
}
