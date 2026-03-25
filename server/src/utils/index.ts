import { query } from '../config/database';

export async function getNextDailyNumber(): Promise<number> {
  const result = await query(`
    INSERT INTO daily_counters (counter_date, last_number)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (counter_date)
    DO UPDATE SET last_number = daily_counters.last_number + 1
    RETURNING last_number
  `);
  return result.rows[0].last_number;
}

export function calcOrderTotals(items: Array<{ unit_price: number; quantity: number; tax_rate: number; price_extra?: number }>, discountPercent = 0) {
  let subtotal = 0;
  let tax = 0;
  for (const item of items) {
    const lineTotal = (item.unit_price + (item.price_extra || 0)) * item.quantity;
    subtotal += lineTotal;
    tax += lineTotal * item.tax_rate;
  }
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount + tax;
  return {
    subtotal: +subtotal.toFixed(2),
    tax: +tax.toFixed(2),
    discount_amount: +discountAmount.toFixed(2),
    total: +total.toFixed(2),
  };
}
