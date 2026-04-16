import { db } from './db';
import { enqueue, nextTempId } from './syncQueue';

// ─── Local Order Operations (offline) ───

export async function localCreateOrder(waiterId: number, data: {
  table_id?: number; order_type?: string; guest_count?: number;
}) {
  const tempId = nextTempId();
  const now = new Date().toISOString();

  // Get next local daily number
  const meta = await db.meta.get('localDailyNumber');
  const dailyNum = meta ? parseInt(meta.value) + 1 : 9000; // Start high to avoid collision
  await db.meta.put({ key: 'localDailyNumber', value: String(dailyNum) });

  const order = {
    id: tempId,
    daily_number: dailyNum,
    table_id: data.table_id || null,
    waiter_id: waiterId,
    status: 'open',
    subtotal: 0, tax: 0, discount_percent: 0, discount_amount: 0,
    tip: 0, total: 0, guest_count: data.guest_count || 0,
    notes: '', order_type: data.order_type || 'dine_in',
    created_at: now, updated_at: now, closed_at: null,
    _offline: true, _tempId: String(tempId),
  };

  await db.orders.put(order);

  // Update table status if applicable
  if (data.table_id) {
    await db.tables.update(data.table_id, {
      status: 'occupied', current_order_id: tempId,
    });
  }

  // Queue for sync
  await enqueue({
    operation: 'create_order',
    endpoint: '/orders',
    method: 'POST',
    payload: { table_id: data.table_id, order_type: data.order_type, guest_count: data.guest_count },
    tempId: String(tempId),
  });

  return order;
}

export async function localAddItem(orderId: number, data: {
  product_id: number; quantity: number; notes?: string;
}) {
  const product = await db.products.get(data.product_id);
  if (!product) throw new Error('Producto no encontrado en cache');

  const tempId = nextTempId();
  const now = new Date().toISOString();

  const item = {
    id: tempId,
    order_id: orderId,
    product_id: data.product_id,
    product_name: product.name,
    quantity: data.quantity,
    unit_price: product.price,
    tax_rate: product.tax_rate || 0.16,
    notes: data.notes || '',
    status: 'pending',
    printer_target: product.printer_target || '',
    created_at: now,
    _offline: true,
    _tempId: String(tempId),
  };

  await db.orderItems.put(item);
  await recalcOrderTotals(orderId);

  // Queue for sync
  await enqueue({
    operation: 'add_item',
    endpoint: `/orders/${orderId}/items`,
    method: 'POST',
    payload: { product_id: data.product_id, quantity: data.quantity, notes: data.notes },
    tempId: String(tempId),
    dependsOnTempId: orderId < 0 ? String(orderId) : undefined,
  });

  return item;
}

export async function localUpdateItem(orderId: number, itemId: number, data: {
  quantity?: number; notes?: string; status?: string;
}) {
  const item = await db.orderItems.get(itemId);
  if (!item) throw new Error('Item no encontrado');

  const updates: any = {};
  if (data.quantity !== undefined) updates.quantity = data.quantity;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.status !== undefined) updates.status = data.status;

  await db.orderItems.update(itemId, updates);
  await recalcOrderTotals(orderId);

  await enqueue({
    operation: 'update_item',
    endpoint: `/orders/${orderId}/items/${itemId}`,
    method: 'PUT',
    payload: data,
    dependsOnTempId: orderId < 0 ? String(orderId) : undefined,
  });
}

export async function localRemoveItem(orderId: number, itemId: number) {
  await db.orderItems.delete(itemId);
  await recalcOrderTotals(orderId);

  await enqueue({
    operation: 'remove_item',
    endpoint: `/orders/${orderId}/items/${itemId}`,
    method: 'DELETE',
    payload: {},
    dependsOnTempId: orderId < 0 ? String(orderId) : undefined,
  });
}

export async function localProcessPayment(cashierId: number, data: {
  order_id: number; method: string; amount: number; tip?: number;
  received_amount?: number;
}) {
  const order = await db.orders.get(data.order_id);
  if (!order) throw new Error('Orden no encontrada');

  const changeAmount = data.method === 'cash' && data.received_amount
    ? Math.max(0, data.received_amount - data.amount - (data.tip || 0))
    : 0;

  const payment = {
    id: nextTempId(),
    order_id: data.order_id,
    method: data.method,
    amount: data.amount,
    tip: data.tip || 0,
    reference: '',
    received_amount: data.received_amount || data.amount,
    change_amount: changeAmount,
    cashier_id: cashierId,
    created_at: new Date().toISOString(),
    _offline: true,
  };

  await db.payments.put(payment);

  // Check if fully paid
  const allPayments = await db.payments.where('order_id').equals(data.order_id).toArray();
  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);

  if (totalPaid >= order.total) {
    await db.orders.update(data.order_id, {
      status: 'closed', closed_at: new Date().toISOString(),
      tip: allPayments.reduce((s, p) => s + p.tip, 0),
    });
    // Free table
    if (order.table_id) {
      await db.tables.update(order.table_id, { status: 'free', current_order_id: null });
    }
  }

  await enqueue({
    operation: 'process_payment',
    endpoint: '/payments',
    method: 'POST',
    payload: data,
    dependsOnTempId: data.order_id < 0 ? String(data.order_id) : undefined,
  });

  return {
    paid: totalPaid,
    remaining: Math.max(0, order.total - totalPaid),
    change: changeAmount,
    status: totalPaid >= order.total ? 'closed' : 'partial',
  };
}

// ─── Recalculate order totals ───

async function recalcOrderTotals(orderId: number) {
  const items = await db.orderItems.where('order_id').equals(orderId).toArray();
  const order = await db.orders.get(orderId);
  if (!order) return;

  const activeItems = items.filter(i => i.status !== 'cancelled');
  let subtotal = 0;
  let tax = 0;

  for (const item of activeItems) {
    const itemSubtotal = item.unit_price * item.quantity;
    const itemTax = itemSubtotal * item.tax_rate;
    subtotal += itemSubtotal;
    tax += itemTax;
  }

  const discountAmount = subtotal * (order.discount_percent / 100);
  const total = subtotal - discountAmount + tax + order.tip;

  await db.orders.update(orderId, {
    subtotal, tax, discount_amount: discountAmount,
    total: Math.max(0, total), updated_at: new Date().toISOString(),
  });
}

// ─── Read operations ───

export async function getLocalOrders(status?: string) {
  let orders = await db.orders.toArray();
  if (status) {
    const statuses = status.split(',');
    orders = orders.filter(o => statuses.includes(o.status));
  }
  return orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getLocalOrder(orderId: number) {
  const order = await db.orders.get(orderId);
  if (!order) return null;
  const items = await db.orderItems.where('order_id').equals(orderId).toArray();
  return { ...order, items };
}

export async function getLocalOrderByTable(tableId: number) {
  const order = await db.orders.where('table_id').equals(tableId).filter(o => ['open', 'sent', 'partial'].includes(o.status)).first();
  if (!order) return null;
  const items = await db.orderItems.where('order_id').equals(order.id).toArray();
  return { ...order, items };
}
