import { query } from '../../config/database';

export async function getDailySummary(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];

  const orders = await query(`
    SELECT COUNT(*) as total_orders,
      COUNT(CASE WHEN status='closed' THEN 1 END) as closed_orders,
      COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled_orders,
      COALESCE(SUM(CASE WHEN status='closed' THEN subtotal END), 0) as total_subtotal,
      COALESCE(SUM(CASE WHEN status='closed' THEN tax END), 0) as total_tax,
      COALESCE(SUM(CASE WHEN status='closed' THEN discount_amount END), 0) as total_discounts,
      COALESCE(SUM(CASE WHEN status='closed' THEN tip END), 0) as total_tips,
      COALESCE(SUM(CASE WHEN status='closed' THEN total END), 0) as total_sales
    FROM orders WHERE DATE(created_at) = $1
  `, [targetDate]);

  const byMethod = await query(`
    SELECT p.method, COUNT(*) as count, COALESCE(SUM(p.amount), 0) as total
    FROM payments p JOIN orders o ON p.order_id = o.id
    WHERE DATE(p.created_at) = $1 AND o.status = 'closed'
    GROUP BY p.method
  `, [targetDate]);

  const topProducts = await query(`
    SELECT oi.product_name, SUM(oi.quantity) as qty, SUM(oi.unit_price * oi.quantity) as revenue
    FROM order_items oi JOIN orders o ON oi.order_id = o.id
    WHERE DATE(o.created_at) = $1 AND o.status = 'closed' AND oi.status != 'cancelled'
    GROUP BY oi.product_name ORDER BY qty DESC LIMIT 20
  `, [targetDate]);

  const byWaiter = await query(`
    SELECT u.display_name, COUNT(DISTINCT o.id) as orders, COALESCE(SUM(o.total), 0) as total
    FROM orders o JOIN users u ON o.waiter_id = u.id
    WHERE DATE(o.created_at) = $1 AND o.status = 'closed'
    GROUP BY u.id, u.display_name ORDER BY total DESC
  `, [targetDate]);

  const byHour = await query(`
    SELECT EXTRACT(HOUR FROM o.created_at) as hour, COUNT(*) as orders, COALESCE(SUM(o.total), 0) as total
    FROM orders o WHERE DATE(o.created_at) = $1 AND o.status = 'closed'
    GROUP BY hour ORDER BY hour
  `, [targetDate]);

  return {
    date: targetDate,
    summary: orders.rows[0],
    by_method: byMethod.rows,
    top_products: topProducts.rows,
    by_waiter: byWaiter.rows,
    by_hour: byHour.rows,
  };
}

export async function getSalesByPeriod(startDate: string, endDate: string) {
  const result = await query(`
    SELECT DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total), 0) as total
    FROM orders WHERE DATE(created_at) BETWEEN $1 AND $2 AND status = 'closed'
    GROUP BY DATE(created_at) ORDER BY date
  `, [startDate, endDate]);
  return result.rows;
}

export async function getSalesByWaiter(startDate: string, endDate: string) {
  const result = await query(`
    SELECT u.display_name, u.username,
      COUNT(DISTINCT o.id) as orders,
      COALESCE(SUM(o.subtotal), 0) as subtotal,
      COALESCE(SUM(o.tax), 0) as tax,
      COALESCE(SUM(o.discount_amount), 0) as discounts,
      COALESCE(SUM(o.tip), 0) as tips,
      COALESCE(SUM(o.total), 0) as total,
      COALESCE(AVG(o.total), 0) as avg_ticket
    FROM orders o JOIN users u ON o.waiter_id = u.id
    WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND o.status = 'closed'
    GROUP BY u.id, u.display_name, u.username ORDER BY total DESC
  `, [startDate, endDate]);
  return result.rows;
}

export async function getSalesByCategory(startDate: string, endDate: string) {
  const result = await query(`
    SELECT c.name as category_name, c.color,
      pc.name as parent_name,
      COUNT(DISTINCT o.id) as orders,
      SUM(oi.quantity) as qty,
      COALESCE(SUM(oi.unit_price * oi.quantity), 0) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_name = p.name
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE DATE(o.created_at) BETWEEN $1 AND $2
      AND o.status = 'closed' AND oi.status != 'cancelled'
    GROUP BY c.id, c.name, c.color, pc.name
    ORDER BY revenue DESC
  `, [startDate, endDate]);
  return result.rows;
}

export async function getSalesByProduct(startDate: string, endDate: string) {
  const result = await query(`
    SELECT oi.product_name, c.name as category_name,
      SUM(oi.quantity) as qty,
      COALESCE(SUM(oi.unit_price * oi.quantity), 0) as revenue,
      COUNT(DISTINCT o.id) as orders
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_name = p.name
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE DATE(o.created_at) BETWEEN $1 AND $2
      AND o.status = 'closed' AND oi.status != 'cancelled'
    GROUP BY oi.product_name, c.name
    ORDER BY qty DESC
  `, [startDate, endDate]);
  return result.rows;
}

export async function getSalesByHour(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const result = await query(`
    SELECT EXTRACT(HOUR FROM o.created_at) as hour,
      COUNT(*) as orders,
      COALESCE(SUM(o.total), 0) as total,
      COALESCE(AVG(o.total), 0) as avg_ticket
    FROM orders o
    WHERE DATE(o.created_at) = $1 AND o.status = 'closed'
    GROUP BY hour ORDER BY hour
  `, [targetDate]);
  return result.rows;
}

export async function getCancellations(startDate: string, endDate: string) {
  const cancelledOrders = await query(`
    SELECT o.id, o.order_number, o.created_at, o.total, o.notes,
      u.display_name as waiter_name, t.label as table_label
    FROM orders o
    LEFT JOIN users u ON o.waiter_id = u.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND o.status = 'cancelled'
    ORDER BY o.created_at DESC
  `, [startDate, endDate]);

  const cancelledItems = await query(`
    SELECT oi.product_name, oi.quantity, oi.unit_price, oi.notes,
      o.order_number, o.created_at
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND oi.status = 'cancelled'
    ORDER BY o.created_at DESC
  `, [startDate, endDate]);

  const summary = await query(`
    SELECT
      COUNT(DISTINCT CASE WHEN o.status='cancelled' THEN o.id END) as cancelled_orders,
      COALESCE(SUM(CASE WHEN o.status='cancelled' THEN o.total END), 0) as cancelled_total,
      COUNT(CASE WHEN oi.status='cancelled' THEN 1 END) as cancelled_items,
      COALESCE(SUM(CASE WHEN oi.status='cancelled' THEN oi.unit_price * oi.quantity END), 0) as cancelled_items_total
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE DATE(o.created_at) BETWEEN $1 AND $2
  `, [startDate, endDate]);

  return {
    summary: summary.rows[0],
    cancelled_orders: cancelledOrders.rows,
    cancelled_items: cancelledItems.rows,
  };
}

export async function getDiscounts(startDate: string, endDate: string) {
  const result = await query(`
    SELECT o.id, o.order_number, o.created_at, o.discount_type, o.discount_value,
      o.discount_amount, o.subtotal, o.total, o.notes,
      u.display_name as waiter_name, t.label as table_label
    FROM orders o
    LEFT JOIN users u ON o.waiter_id = u.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND o.status = 'closed'
      AND o.discount_amount > 0
    ORDER BY o.discount_amount DESC
  `, [startDate, endDate]);

  const summary = await query(`
    SELECT
      COUNT(*) as total_with_discount,
      COALESCE(SUM(o.discount_amount), 0) as total_discounts,
      COALESCE(AVG(o.discount_amount), 0) as avg_discount,
      COUNT(CASE WHEN o.discount_type='percent' THEN 1 END) as percent_count,
      COUNT(CASE WHEN o.discount_type='amount' THEN 1 END) as amount_count
    FROM orders o
    WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND o.status = 'closed'
      AND o.discount_amount > 0
  `, [startDate, endDate]);

  return {
    summary: summary.rows[0],
    orders: result.rows,
  };
}

// Consultas - Open checks
export async function getOpenChecks() {
  const result = await query(`
    SELECT o.*, u.display_name as waiter_name, t.label as table_label,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status != 'cancelled') as item_count
    FROM orders o
    LEFT JOIN users u ON o.waiter_id = u.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('open', 'sent')
    ORDER BY o.created_at ASC
  `);
  return result.rows;
}

// Consultas - Paid checks
export async function getPaidChecks(startDate: string, endDate: string) {
  const result = await query(`
    SELECT o.*, u.display_name as waiter_name, t.label as table_label,
      (SELECT string_agg(DISTINCT p.method, ', ') FROM payments p WHERE p.order_id = o.id) as payment_methods,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status != 'cancelled') as item_count
    FROM orders o
    LEFT JOIN users u ON o.waiter_id = u.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status = 'closed' AND DATE(o.created_at) BETWEEN $1 AND $2
    ORDER BY o.created_at DESC
  `, [startDate, endDate]);
  return result.rows;
}

// Consultas - Cancelled checks
export async function getCancelledChecks(startDate: string, endDate: string) {
  const result = await query(`
    SELECT o.*, u.display_name as waiter_name, t.label as table_label,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
    FROM orders o
    LEFT JOIN users u ON o.waiter_id = u.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status = 'cancelled' AND DATE(o.created_at) BETWEEN $1 AND $2
    ORDER BY o.created_at DESC
  `, [startDate, endDate]);
  return result.rows;
}
