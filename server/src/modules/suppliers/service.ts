import { query } from '../../config/database';

export async function getAll() {
  const result = await query(
    'SELECT * FROM suppliers WHERE is_active = true ORDER BY name'
  );
  return result.rows;
}

export async function getById(id: number) {
  const result = await query('SELECT * FROM suppliers WHERE id = $1', [id]);
  return result.rows[0];
}

export async function create(data: {
  name: string;
  contact_name?: string;
  phone?: string;
  address?: string;
  bank_name?: string;
  account_number?: string;
  clabe?: string;
  email?: string;
  whatsapp?: string;
  notes?: string;
  shipping_cost?: number;
  free_shipping_min?: number;
}) {
  const result = await query(
    `INSERT INTO suppliers (name, contact_name, phone, address, bank_name, account_number, clabe, email, whatsapp, notes, shipping_cost, free_shipping_min)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [data.name, data.contact_name || null, data.phone || null, data.address || null,
     data.bank_name || null, data.account_number || null, data.clabe || null,
     data.email || null, data.whatsapp || null, data.notes || null,
     data.shipping_cost || 0, data.free_shipping_min || 0]
  );
  return result.rows[0];
}

export async function update(id: number, data: Record<string, any>) {
  const fields = Object.keys(data).filter(k => data[k] !== undefined);
  if (fields.length === 0) return getById(id);

  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => data[f] || null);

  const result = await query(
    `UPDATE suppliers SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0];
}

export async function remove(id: number) {
  await query('UPDATE suppliers SET is_active = false WHERE id = $1', [id]);
}

export async function getSupplierItems(supplierId: number) {
  const result = await query(
    `SELECT iis.item_id, iis.price, iis.delivery_days,
            ii.name as item_name, ii.unit
     FROM inventory_item_suppliers iis
     JOIN inventory_items ii ON ii.id = iis.item_id
     WHERE iis.supplier_id = $1
     ORDER BY ii.name`,
    [supplierId]
  );
  return result.rows;
}
