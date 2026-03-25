import { query } from '../../config/database';

export async function getOpen() {
  const result = await query(`SELECT * FROM cash_registers WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`);
  return result.rows[0] || null;
}

export async function open(userId: number, openingAmount: number) {
  const existing = await getOpen();
  if (existing) throw new Error('Ya hay una caja abierta');

  const result = await query(
    'INSERT INTO cash_registers (opened_by, opening_amount) VALUES ($1, $2) RETURNING *',
    [userId, openingAmount]
  );
  return result.rows[0];
}

export async function close(userId: number, actualAmount: number, notes?: string) {
  const register = await getOpen();
  if (!register) throw new Error('No hay caja abierta');

  const snapshot = await buildCashSnapshot(register);
  const expectedAmount = snapshot.expected_cash;
  const difference = actualAmount - expectedAmount;

  const result = await query(
    `UPDATE cash_registers SET status='closed', closed_by=$1, actual_amount=$2, expected_amount=$3, difference=$4, notes=$5, closed_at=NOW() WHERE id=$6 RETURNING *`,
    [userId, actualAmount, expectedAmount.toFixed(2), difference.toFixed(2), notes || null, register.id]
  );
  return result.rows[0];
}

export async function addMovement(registerId: number, userId: number, data: { type: string; amount: number; reason: string; reference?: string; authorized_by?: number }) {
  const result = await query(
    'INSERT INTO cash_movements (register_id, type, amount, reason, reference, user_id, authorized_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [registerId, data.type, data.amount, data.reason, data.reference || null, userId, data.authorized_by || null]
  );
  return result.rows[0];
}

export async function getMovements(registerId: number) {
  const result = await query('SELECT cm.*, u.display_name FROM cash_movements cm JOIN users u ON cm.user_id = u.id WHERE cm.register_id = $1 ORDER BY cm.created_at', [registerId]);
  return result.rows;
}

export async function getHistory(limit = 30) {
  const result = await query(`
    SELECT cr.*, uo.display_name as opened_by_name, uc.display_name as closed_by_name
    FROM cash_registers cr
    LEFT JOIN users uo ON cr.opened_by = uo.id
    LEFT JOIN users uc ON cr.closed_by = uc.id
    ORDER BY cr.opened_at DESC LIMIT $1
  `, [limit]);
  return result.rows;
}

// Build a snapshot of all cash flow data for the current register period
async function buildCashSnapshot(register: any) {
  const since = register.opened_at;

  // Settings (business info)
  const settingsResult = await query(`SELECT key, value FROM settings`);
  const settings: Record<string, string> = {};
  settingsResult.rows.forEach((s: any) => { settings[s.key] = s.value; });

  // All payments during this register period
  const payments = await query(`
    SELECT p.method, COUNT(*) as count, COALESCE(SUM(p.amount), 0) as total,
           COALESCE(SUM(p.tip), 0) as tips
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE p.created_at >= $1 AND o.status = 'closed'
    GROUP BY p.method
  `, [since]);

  // Cash movements
  const movements = await query(`
    SELECT
      COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE 0 END), 0) as total_in,
      COALESCE(SUM(CASE WHEN type='out' THEN amount ELSE 0 END), 0) as total_out
    FROM cash_movements WHERE register_id = $1
  `, [register.id]);

  // Orders summary
  const orders = await query(`
    SELECT COUNT(*) as total_orders,
      COUNT(CASE WHEN status='closed' THEN 1 END) as closed_orders,
      COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled_orders,
      COUNT(CASE WHEN status IN ('open','sent') THEN 1 END) as open_orders,
      COUNT(CASE WHEN status='closed' AND discount_amount > 0 THEN 1 END) as discount_orders,
      COALESCE(SUM(CASE WHEN status='closed' THEN subtotal END), 0) as total_subtotal,
      COALESCE(SUM(CASE WHEN status='closed' THEN tax END), 0) as total_tax,
      COALESCE(SUM(CASE WHEN status='closed' THEN discount_amount END), 0) as total_discounts,
      COALESCE(SUM(CASE WHEN status='closed' THEN tip END), 0) as total_tips,
      COALESCE(SUM(CASE WHEN status='closed' THEN total END), 0) as total_sales,
      COALESCE(SUM(CASE WHEN status='closed' THEN guest_count END), 0) as total_guests,
      MIN(CASE WHEN status='closed' THEN daily_number END) as first_folio,
      MAX(CASE WHEN status='closed' THEN daily_number END) as last_folio
    FROM orders WHERE created_at >= $1
  `, [since]);

  // Sales by product category type (Alimentos / Bebidas / Otros)
  const byCategory = await query(`
    SELECT
      COALESCE(c.printer_target, 'none') as cat_type,
      COALESCE(SUM(oi.unit_price * oi.quantity / (1 + oi.tax_rate)), 0) as subtotal_no_tax,
      SUM(oi.quantity) as qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.created_at >= $1 AND o.status = 'closed' AND oi.status != 'cancelled'
    GROUP BY c.printer_target
  `, [since]);

  // Sales by service type (comedor / quick)
  const byServiceType = await query(`
    SELECT
      COALESCE(o.order_type, 'dine_in') as service_type,
      COALESCE(SUM(o.subtotal), 0) as total
    FROM orders o
    WHERE o.created_at >= $1 AND o.status = 'closed'
    GROUP BY o.order_type
  `, [since]);

  // Tips by payment method
  const tipsByMethod = await query(`
    SELECT p.method, COALESCE(SUM(p.tip), 0) as tips
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE p.created_at >= $1 AND o.status = 'closed' AND p.tip > 0
    GROUP BY p.method
  `, [since]);

  // By waiter
  const byWaiter = await query(`
    SELECT u.display_name, COUNT(DISTINCT o.id) as orders, COALESCE(SUM(o.total), 0) as total
    FROM orders o JOIN users u ON o.waiter_id = u.id
    WHERE o.created_at >= $1 AND o.status = 'closed'
    GROUP BY u.id, u.display_name ORDER BY total DESC
  `, [since]);

  // Top products
  const topProducts = await query(`
    SELECT oi.product_name, SUM(oi.quantity) as qty, SUM(oi.unit_price * oi.quantity) as revenue
    FROM order_items oi JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= $1 AND o.status = 'closed' AND oi.status != 'cancelled'
    GROUP BY oi.product_name ORDER BY qty DESC LIMIT 20
  `, [since]);

  // Discounts by category
  const discountsByCategory = await query(`
    SELECT
      COALESCE(c.printer_target, 'none') as cat_type,
      COALESCE(SUM(oi.unit_price * oi.quantity * o.discount_percent / 100), 0) as discount_amount
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.created_at >= $1 AND o.status = 'closed' AND oi.status != 'cancelled' AND o.discount_percent > 0
    GROUP BY c.printer_target
  `, [since]);

  const openingAmount = parseFloat(register.opening_amount);
  const cashTotal = payments.rows.find((p: any) => p.method === 'cash');
  const cashSales = cashTotal ? parseFloat(cashTotal.total) : 0;
  const cashTips = cashTotal ? parseFloat(cashTotal.tips) : 0;
  const cardMethods = payments.rows.filter((p: any) => p.method !== 'cash' && p.method !== 'transfer' && p.method !== 'other');
  const cardSales = cardMethods.reduce((s: number, p: any) => s + parseFloat(p.total), 0);
  const totalTips = parseFloat(orders.rows[0]?.total_tips || '0');
  const movIn = parseFloat(movements.rows[0].total_in);
  const movOut = parseFloat(movements.rows[0].total_out);
  const expectedCash = openingAmount + cashSales + movIn - movOut;
  const totalAllMethods = payments.rows.reduce((sum: number, p: any) => sum + parseFloat(p.total), 0);
  const saldoFinal = openingAmount + totalAllMethods + movIn - movOut;

  // Map category types to friendly names
  const catMap: Record<string, string> = { kitchen: 'Alimentos', bar: 'Bebidas', both: 'Alimentos', none: 'Otros' };
  const byCategoryMapped = byCategory.rows.map((c: any) => ({
    name: catMap[c.cat_type] || 'Otros',
    subtotal: parseFloat(c.subtotal_no_tax),
    qty: parseInt(c.qty),
  }));
  // Merge duplicates (kitchen+both -> Alimentos)
  const categoryTotals: Record<string, { subtotal: number; qty: number }> = {};
  byCategoryMapped.forEach((c: any) => {
    if (!categoryTotals[c.name]) categoryTotals[c.name] = { subtotal: 0, qty: 0 };
    categoryTotals[c.name].subtotal += c.subtotal;
    categoryTotals[c.name].qty += c.qty;
  });

  const serviceTypes = byServiceType.rows.map((s: any) => ({
    name: s.service_type === 'quick' ? 'Rápido' : 'Comedor',
    total: parseFloat(s.total),
  }));

  const closedCount = parseInt(orders.rows[0]?.closed_orders || '0');
  const totalSales = parseFloat(orders.rows[0]?.total_sales || '0');
  const avgCheck = closedCount > 0 ? totalSales / closedCount : 0;
  const totalGuests = parseInt(orders.rows[0]?.total_guests || '0');

  return {
    settings,
    register,
    opening_amount: openingAmount,
    expected_cash: expectedCash,
    cash_sales: cashSales,
    card_sales: cardSales,
    cash_tips: cashTips,
    total_tips: totalTips,
    movements_in: movIn,
    movements_out: movOut,
    saldo_final: saldoFinal,
    total_all_methods: totalAllMethods,
    by_method: payments.rows,
    tips_by_method: tipsByMethod.rows,
    orders: orders.rows[0],
    by_category: categoryTotals,
    by_service_type: serviceTypes,
    discounts_by_category: discountsByCategory.rows,
    by_waiter: byWaiter.rows,
    top_products: topProducts.rows,
    avg_check: avgCheck,
    total_guests: totalGuests,
  };
}

// Corte X - Partial informational snapshot (does NOT close the register or reset counters)
export async function corteX() {
  const register = await getOpen();
  if (!register) throw new Error('No hay caja abierta para realizar Corte X');

  const snapshot = await buildCashSnapshot(register);
  const movements = await getMovements(register.id);

  return {
    type: 'X',
    timestamp: new Date().toISOString(),
    ...snapshot,
    movements,
  };
}

// Corte Z - Daily closing (closes the register, resets counters for the day)
export async function corteZ(userId: number) {
  const register = await getOpen();
  if (!register) throw new Error('No hay caja abierta para realizar Corte Z');

  // Check for open orders
  const openOrders = await query(`
    SELECT COUNT(*) as count FROM orders
    WHERE status IN ('open', 'sent') AND created_at >= $1
  `, [register.opened_at]);

  if (parseInt(openOrders.rows[0].count) > 0) {
    throw new Error(`Hay ${openOrders.rows[0].count} cuenta(s) abierta(s). Cierra todas las cuentas antes del Corte Z.`);
  }

  const snapshot = await buildCashSnapshot(register);
  const movements = await getMovements(register.id);

  // Close the register with the expected cash as actual (Corte Z is definitive)
  await query(
    `UPDATE cash_registers SET status='closed', closed_by=$1, actual_amount=$2, expected_amount=$3, difference=0, notes='Corte Z', closed_at=NOW() WHERE id=$4`,
    [userId, snapshot.expected_cash.toFixed(2), snapshot.expected_cash.toFixed(2), register.id]
  );

  return {
    type: 'Z',
    timestamp: new Date().toISOString(),
    ...snapshot,
    movements,
  };
}
