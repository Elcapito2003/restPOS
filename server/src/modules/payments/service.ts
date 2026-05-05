import { query, getClient } from '../../config/database';
import { getIO } from '../../config/socket';

export async function processPayment(cashierId: number, data: {
  order_id: number; method: string; amount: number; tip?: number; reference?: string; received_amount?: number;
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [data.order_id]);
    if (orderResult.rows.length === 0) throw new Error('Orden no encontrada');
    const order = orderResult.rows[0];
    if (order.status === 'closed') throw new Error('Orden ya cerrada');

    const changeAmount = data.method === 'cash' && data.received_amount
      ? Math.max(0, data.received_amount - data.amount - (data.tip || 0))
      : 0;

    await client.query(
      'INSERT INTO payments (order_id, method, amount, tip, reference, received_amount, change_amount, cashier_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [data.order_id, data.method, data.amount, data.tip || 0, data.reference || null, data.received_amount || data.amount, changeAmount, cashierId]
    );

    // Update tip on order
    if (data.tip) {
      await client.query('UPDATE orders SET tip = COALESCE(tip,0) + $1 WHERE id = $2', [data.tip, data.order_id]);
    }

    // Check if fully paid
    const paymentsResult = await client.query('SELECT COALESCE(SUM(amount),0) as paid FROM payments WHERE order_id = $1', [data.order_id]);
    const totalPaid = parseFloat(paymentsResult.rows[0].paid);
    const orderTotal = parseFloat(order.total);

    if (totalPaid >= orderTotal) {
      await client.query(`UPDATE orders SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = $1`, [data.order_id]);
      // Liberar mesa SOLO si no quedan otras órdenes activas. Si las hay
      // (split bills, varias órdenes en la misma mesa), reapuntar
      // current_order_id a la más reciente y mantenerla ocupada.
      if (order.table_id) {
        const remaining = await client.query(
          `SELECT id FROM orders WHERE table_id = $1 AND status IN ('open','sent','partial') AND id <> $2 ORDER BY created_at DESC LIMIT 1`,
          [order.table_id, data.order_id]
        );
        if (remaining.rows.length === 0) {
          await client.query(`UPDATE tables SET status = 'free', current_order_id = NULL WHERE id = $1`, [order.table_id]);
        } else {
          await client.query(`UPDATE tables SET status = 'occupied', current_order_id = $1 WHERE id = $2`, [remaining.rows[0].id, order.table_id]);
        }
        const table = (await client.query('SELECT * FROM tables WHERE id = $1', [order.table_id])).rows[0];
        try { getIO().to(`floor:${table.floor_id}`).emit('table:status_changed', table); } catch {}
      }
      try { getIO().emit('order:closed', { id: data.order_id }); } catch {}

      // Auto-deduct inventory for recipe-based products (after commit, separate transaction)
      setTimeout(async () => {
        try {
          const { deductForOrder } = await import('../productRecipes/service');
          await deductForOrder(data.order_id);
        } catch (err: any) {
          console.error('[AUTO-DEDUCT] Failed for order', data.order_id, err.message);
        }
      }, 0);
    } else {
      await client.query(`UPDATE orders SET status = 'partial', updated_at = NOW() WHERE id = $1`, [data.order_id]);
    }

    await client.query('COMMIT');

    return {
      paid: totalPaid,
      remaining: Math.max(0, orderTotal - totalPaid),
      change: changeAmount,
      status: totalPaid >= orderTotal ? 'closed' : 'partial',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function processSplitPayment(cashierId: number, data: { order_id: number; payments: any[] }) {
  let lastResult: any;
  for (const payment of data.payments) {
    lastResult = await processPayment(cashierId, { ...payment, order_id: data.order_id });
  }
  return lastResult;
}

export async function getByOrder(orderId: number) {
  const result = await query('SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at', [orderId]);
  return result.rows;
}

export async function voidPayment(paymentId: number) {
  const payment = await query('SELECT * FROM payments WHERE id = $1', [paymentId]);
  if (payment.rows.length === 0) throw new Error('Pago no encontrado');
  await query('DELETE FROM payments WHERE id = $1', [paymentId]);

  const orderId = payment.rows[0].order_id;
  await query(`UPDATE orders SET status = 'sent', closed_at = NULL, updated_at = NOW() WHERE id = $1`, [orderId]);

  const order = (await query('SELECT * FROM orders WHERE id = $1', [orderId])).rows[0];
  if (order.table_id) {
    await query(`UPDATE tables SET status = 'occupied', current_order_id = $1 WHERE id = $2`, [orderId, order.table_id]);
  }
}
