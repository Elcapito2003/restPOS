import { query } from '../../config/database';
import { sendWhatsApp } from './openclaw';

// ─── Orders ───

export async function getOrders(status?: string) {
  let sql = `
    SELECT o.*, s.name as supplier_name, s.whatsapp as supplier_phone,
      u.display_name as created_by_name,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', oi.id, 'item_id', oi.item_id, 'item_name', oi.item_name,
          'quantity', oi.quantity, 'unit', oi.unit,
          'estimated_price', oi.estimated_price, 'confirmed_price', oi.confirmed_price
        ) ORDER BY oi.id)
        FROM supplier_order_items oi WHERE oi.order_id = o.id
      ), '[]'::json) as items
    FROM supplier_orders o
    JOIN suppliers s ON s.id = o.supplier_id
    LEFT JOIN users u ON u.id = o.created_by
  `;
  const params: any[] = [];
  if (status) {
    sql += ' WHERE o.status = $1';
    params.push(status);
  }
  sql += ' GROUP BY o.id, s.name, s.whatsapp, u.display_name ORDER BY o.created_at DESC';
  const result = await query(sql, params);
  return result.rows;
}

export async function getOrderById(id: number) {
  const result = await query(`
    SELECT o.*, s.name as supplier_name, s.whatsapp as supplier_phone,
      u.display_name as created_by_name
    FROM supplier_orders o
    JOIN suppliers s ON s.id = o.supplier_id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.id = $1
  `, [id]);
  return result.rows[0];
}

export async function createOrder(userId: number, data: {
  supplier_id: number; notes?: string;
  items: { item_id: number; item_name: string; quantity: number; unit?: string; estimated_price?: number; }[];
}) {
  const estimatedTotal = data.items.reduce((sum, i) => sum + (i.estimated_price || 0) * i.quantity, 0);

  const orderResult = await query(
    `INSERT INTO supplier_orders (supplier_id, notes, estimated_total, created_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [data.supplier_id, data.notes || null, estimatedTotal, userId]
  );
  const order = orderResult.rows[0];

  for (const item of data.items) {
    await query(
      `INSERT INTO supplier_order_items (order_id, item_id, item_name, quantity, unit, estimated_price)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [order.id, item.item_id, item.item_name, item.quantity, item.unit || null, item.estimated_price || 0]
    );
  }

  return getOrderById(order.id);
}

export async function updateOrderStatus(id: number, status: string) {
  const extra: Record<string, string> = {};
  if (status === 'sent') extra.sent_at = 'NOW()';
  if (status === 'confirmed') extra.confirmed_at = 'NOW()';
  if (status === 'received') extra.received_at = 'NOW()';

  const setClauses = [`status = $2`, ...Object.entries(extra).map(([k, v]) => `${k} = ${v}`)];
  const result = await query(
    `UPDATE supplier_orders SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return result.rows[0];
}

export async function cancelOrder(id: number) {
  return updateOrderStatus(id, 'cancelled');
}

// ─── WhatsApp Messages ───

export async function getMessages(orderId: number) {
  const result = await query(
    `SELECT * FROM whatsapp_messages WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId]
  );
  return result.rows;
}

export async function getConversation(supplierId: number) {
  const result = await query(
    `SELECT * FROM whatsapp_messages WHERE supplier_id = $1 ORDER BY created_at ASC`,
    [supplierId]
  );
  return result.rows;
}

export async function sendOrderMessage(orderId: number, customMessage?: string) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Pedido no encontrado');

  const itemsResult = await query(
    'SELECT * FROM supplier_order_items WHERE order_id = $1 ORDER BY id',
    [orderId]
  );

  const phone = order.supplier_phone;
  if (!phone) throw new Error('El proveedor no tiene WhatsApp registrado');

  const message = customMessage || buildOrderMessage(order.supplier_name, itemsResult.rows);

  await sendWhatsApp(phone, message);

  const msgResult = await query(
    `INSERT INTO whatsapp_messages (order_id, supplier_id, direction, message, phone, status)
     VALUES ($1,$2,'out',$3,$4,'sent') RETURNING *`,
    [orderId, order.supplier_id, message, phone]
  );

  if (order.status === 'draft') {
    await updateOrderStatus(orderId, 'sent');
  }

  return msgResult.rows[0];
}

export async function sendFreeMessage(orderId: number, supplierId: number, message: string) {
  const supplier = await query('SELECT whatsapp FROM suppliers WHERE id = $1', [supplierId]);
  const phone = supplier.rows[0]?.whatsapp;
  if (!phone) throw new Error('El proveedor no tiene WhatsApp registrado');

  await sendWhatsApp(phone, message);

  const result = await query(
    `INSERT INTO whatsapp_messages (order_id, supplier_id, direction, message, phone, status)
     VALUES ($1,$2,'out',$3,$4,'sent') RETURNING *`,
    [orderId, supplierId, message, phone]
  );
  return result.rows[0];
}

/** Webhook: save incoming message from OpenClaw */
export async function receiveMessage(phone: string, message: string, waMessageId?: string) {
  // Normalize phone: strip +, and extract last 10 digits for MX local match
  const digits = phone.replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;

  // Find supplier by phone (try full number, local number, and with country code variants)
  const supplierResult = await query(
    `SELECT id FROM suppliers
     WHERE whatsapp = $1 OR phone = $1
        OR whatsapp = $2 OR phone = $2
        OR whatsapp = $3 OR phone = $3
     LIMIT 1`,
    [digits, local, `+${digits}`]
  );
  const supplierId = supplierResult.rows[0]?.id || null;

  // Find most recent active order for this supplier
  let orderId = null;
  if (supplierId) {
    const orderResult = await query(
      `SELECT id FROM supplier_orders WHERE supplier_id = $1 AND status IN ('sent','confirmed')
       ORDER BY created_at DESC LIMIT 1`,
      [supplierId]
    );
    orderId = orderResult.rows[0]?.id || null;
  }

  const result = await query(
    `INSERT INTO whatsapp_messages (order_id, supplier_id, direction, message, phone, wa_message_id, status)
     VALUES ($1,$2,'in',$3,$4,$5,'delivered') RETURNING *`,
    [orderId, supplierId, message, phone, waMessageId || null]
  );
  return result.rows[0];
}

// ─── Reception ───

export async function getOrdersForReception() {
  const result = await query(`
    SELECT o.*, s.name as supplier_name, s.whatsapp as supplier_phone,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', oi.id, 'item_id', oi.item_id, 'item_name', oi.item_name,
          'quantity', oi.quantity, 'unit', oi.unit,
          'estimated_price', oi.estimated_price, 'confirmed_price', oi.confirmed_price,
          'received_quantity', oi.received_quantity, 'received_price', oi.received_price
        ) ORDER BY oi.id)
        FROM supplier_order_items oi WHERE oi.order_id = o.id
      ), '[]'::json) as items
    FROM supplier_orders o
    JOIN suppliers s ON s.id = o.supplier_id
    WHERE o.status IN ('sent', 'confirmed', 'received')
    ORDER BY
      CASE o.status WHEN 'sent' THEN 1 WHEN 'confirmed' THEN 2 WHEN 'received' THEN 3 END,
      o.created_at DESC
  `);
  return result.rows;
}

export async function getOrdersPendingPayment() {
  const result = await query(`
    SELECT o.*, s.name as supplier_name, s.whatsapp as supplier_phone,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', oi.id, 'item_name', oi.item_name,
          'quantity', oi.quantity, 'unit', oi.unit,
          'received_quantity', oi.received_quantity,
          'received_price', COALESCE(oi.received_price, oi.confirmed_price, oi.estimated_price)
        ) ORDER BY oi.id)
        FROM supplier_order_items oi WHERE oi.order_id = o.id
      ), '[]'::json) as items
    FROM supplier_orders o
    JOIN suppliers s ON s.id = o.supplier_id
    WHERE o.status = 'received' AND o.payment_status IN ('pending', 'partial')
    ORDER BY o.received_at ASC
  `);
  return result.rows;
}

export async function getOrdersHistory(limit = 50) {
  const result = await query(`
    SELECT o.*, s.name as supplier_name,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'item_name', oi.item_name, 'quantity', oi.quantity, 'unit', oi.unit,
          'received_quantity', oi.received_quantity,
          'received_price', COALESCE(oi.received_price, oi.confirmed_price, oi.estimated_price)
        ) ORDER BY oi.id)
        FROM supplier_order_items oi WHERE oi.order_id = o.id
      ), '[]'::json) as items
    FROM supplier_orders o
    JOIN suppliers s ON s.id = o.supplier_id
    WHERE o.status IN ('received', 'cancelled')
    ORDER BY o.received_at DESC NULLS LAST, o.created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

export async function receiveOrder(orderId: number, data: {
  items: { id: number; received_quantity: number; received_price?: number }[];
  notes?: string;
}) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Pedido no encontrado');

  let receivedTotal = 0;

  // Update each item's received quantity and price
  for (const item of data.items) {
    const price = item.received_price;
    await query(
      `UPDATE supplier_order_items SET received_quantity = $2, received_price = COALESCE($3, confirmed_price, estimated_price)
       WHERE id = $1 RETURNING *`,
      [item.id, item.received_quantity, price || null]
    );

    // Get the item to calculate total and update inventory
    const itemResult = await query(
      `SELECT * FROM supplier_order_items WHERE id = $1`, [item.id]
    );
    const oi = itemResult.rows[0];
    if (!oi) continue;

    const finalPrice = Number(oi.received_price || oi.confirmed_price || oi.estimated_price || 0);
    receivedTotal += finalPrice * item.received_quantity;

    // Auto-update inventory if item_id is linked
    if (oi.item_id && item.received_quantity > 0) {
      // Add stock entry
      await query(
        `INSERT INTO inventory_movements (item_id, type, quantity, reason)
         VALUES ($1, 'entrada', $2, $3)`,
        [oi.item_id, item.received_quantity, `Recepción pedido #${orderId}`]
      );
      // Update stock
      await query(
        `UPDATE inventory_items SET stock = stock + $1, current_cost = CASE WHEN $2 > 0 THEN $2 ELSE current_cost END
         WHERE id = $3`,
        [item.received_quantity, finalPrice, oi.item_id]
      );
    }
  }

  // Update order status
  await query(
    `UPDATE supplier_orders SET status = 'received', received_at = NOW(),
     received_total = $2, reception_notes = $3, payment_status = 'pending'
     WHERE id = $1`,
    [orderId, receivedTotal, data.notes || null]
  );

  return getOrderById(orderId);
}

export async function payOrder(orderId: number, data: {
  amount: number;
  method?: string;
}) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Pedido no encontrado');

  const currentPaid = Number(order.payment_amount || 0);
  const newPaid = currentPaid + data.amount;
  const total = Number(order.received_total || order.confirmed_total || order.estimated_total || 0);
  const paymentStatus = newPaid >= total ? 'paid' : 'partial';

  await query(
    `UPDATE supplier_orders SET payment_amount = $2, payment_status = $3,
     payment_method = COALESCE($4, payment_method),
     paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END
     WHERE id = $1`,
    [orderId, newPaid, paymentStatus, data.method || null]
  );

  return getOrderById(orderId);
}

// ─── Helpers ───

function buildOrderMessage(supplierName: string, items: any[]): string {
  const lines = items.map(i =>
    `- ${i.item_name}: ${Number(i.quantity)} ${i.unit || 'pz'}`
  );
  return [
    `Hola ${supplierName}, buen dia.`,
    `Quisiera hacer un pedido:`,
    '',
    ...lines,
    '',
    `Me podria confirmar disponibilidad y precio por favor? Gracias.`,
  ].join('\n');
}
