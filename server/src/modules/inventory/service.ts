import { query } from '../../config/database';

// --- Inventory Items ---

export async function getItems() {
  const result = await query(`
    SELECT i.*,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'supplier_id', s.id, 'supplier_name', s.name,
          'price', iis.price, 'delivery_days', iis.delivery_days
        ) ORDER BY iis.price)
        FROM inventory_item_suppliers iis
        JOIN suppliers s ON s.id = iis.supplier_id
        WHERE iis.item_id = i.id), '[]'
      ) as suppliers
    FROM inventory_items i
    WHERE i.is_active = true
    ORDER BY i.name
  `);
  return result.rows;
}

export async function getItemById(id: number) {
  const result = await query('SELECT * FROM inventory_items WHERE id = $1', [id]);
  return result.rows[0];
}

export async function createItem(data: {
  name: string; unit: string; units_per_package?: number;
  unit_content?: string; stock_min?: number;
}) {
  const result = await query(
    `INSERT INTO inventory_items (name, unit, units_per_package, unit_content, stock_min)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.name, data.unit, data.units_per_package || 1, data.unit_content || null, data.stock_min || 0]
  );
  return result.rows[0];
}

export async function updateItem(id: number, data: Record<string, any>) {
  const fields = Object.keys(data).filter(k => data[k] !== undefined);
  if (fields.length === 0) return getItemById(id);
  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => data[f]);
  const result = await query(
    `UPDATE inventory_items SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0];
}

export async function removeItem(id: number) {
  await query('UPDATE inventory_items SET is_active = false WHERE id = $1', [id]);
}

// --- Item-Supplier links ---

export async function getItemSuppliers(itemId: number) {
  const result = await query(`
    SELECT iis.*, s.name as supplier_name, s.email, s.whatsapp
    FROM inventory_item_suppliers iis
    JOIN suppliers s ON s.id = iis.supplier_id
    WHERE iis.item_id = $1
    ORDER BY iis.price
  `, [itemId]);
  return result.rows;
}

export async function linkSupplier(data: {
  item_id: number; supplier_id: number; price: number; delivery_days?: number;
}) {
  const result = await query(
    `INSERT INTO inventory_item_suppliers (item_id, supplier_id, price, delivery_days)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (item_id, supplier_id) DO UPDATE SET price = $3, delivery_days = $4
     RETURNING *`,
    [data.item_id, data.supplier_id, data.price, data.delivery_days || 1]
  );
  return result.rows[0];
}

export async function unlinkSupplier(itemId: number, supplierId: number) {
  await query(
    'DELETE FROM inventory_item_suppliers WHERE item_id = $1 AND supplier_id = $2',
    [itemId, supplierId]
  );
}

// --- Movements ---

export async function getMovements(itemId?: number, limit = 50) {
  let sql = `
    SELECT m.*, i.name as item_name, i.unit, u.display_name
    FROM inventory_movements m
    JOIN inventory_items i ON i.id = m.item_id
    LEFT JOIN users u ON u.id = m.user_id
  `;
  const params: any[] = [];
  if (itemId) {
    sql += ' WHERE m.item_id = $1';
    params.push(itemId);
  }
  sql += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  const result = await query(sql, params);
  return result.rows;
}

export async function createMovement(userId: number, data: {
  item_id: number; type: string; quantity: number; reason?: string;
}) {
  const sign = ['entrada', 'produccion_entrada'].includes(data.type) ? 1 : -1;

  const result = await query(
    `INSERT INTO inventory_movements (item_id, type, quantity, reason, user_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.item_id, data.type, data.quantity, data.reason || null, userId]
  );

  await query(
    'UPDATE inventory_items SET stock = stock + $1 WHERE id = $2',
    [data.quantity * sign, data.item_id]
  );

  return result.rows[0];
}

// --- Purchases ---

export async function getPurchases(startDate: string, endDate: string) {
  const result = await query(`
    SELECT p.*, u.display_name
    FROM purchases p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE DATE(p.created_at) BETWEEN $1 AND $2
    ORDER BY p.created_at DESC
  `, [startDate, endDate]);
  return result.rows;
}

export async function createPurchase(userId: number, data: {
  item_id: number; supplier_id?: number; quantity: number;
  unit_cost: number; tax_percent?: number;
}) {
  const taxPct = data.tax_percent ?? 16;
  const subtotal = data.quantity * data.unit_cost;
  const total = subtotal * (1 + taxPct / 100);

  // Get names for historical record
  const item = await query('SELECT name FROM inventory_items WHERE id = $1', [data.item_id]);
  const itemName = item.rows[0]?.name || '';
  let supplierName = null;
  if (data.supplier_id) {
    const sup = await query('SELECT name FROM suppliers WHERE id = $1', [data.supplier_id]);
    supplierName = sup.rows[0]?.name || null;
  }

  const result = await query(
    `INSERT INTO purchases (item_id, supplier_id, item_name, supplier_name, quantity, unit_cost, tax_percent, total, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.item_id, data.supplier_id || null, itemName, supplierName,
     data.quantity, data.unit_cost, taxPct, total, userId]
  );

  // Update stock and cost
  await query(
    'UPDATE inventory_items SET stock = stock + $1, current_cost = $2 WHERE id = $3',
    [data.quantity, data.unit_cost, data.item_id]
  );

  // Log movement
  await query(
    `INSERT INTO inventory_movements (item_id, type, quantity, reason, user_id)
     VALUES ($1, 'entrada', $2, $3, $4)`,
    [data.item_id, data.quantity, `Compra a ${supplierName || 'N/A'}`, userId]
  );

  return result.rows[0];
}

// --- Presentations ---

export async function getPresentations(itemId: number) {
  const result = await query(
    `SELECT * FROM inventory_presentations WHERE item_id = $1 AND is_active = true ORDER BY brand, description`,
    [itemId]
  );
  return result.rows;
}

export async function getAllPresentations() {
  const result = await query(`
    SELECT p.*, i.name as item_name, i.unit as item_unit
    FROM inventory_presentations p
    JOIN inventory_items i ON i.id = p.item_id
    WHERE p.is_active = true
    ORDER BY i.name, p.brand
  `);
  return result.rows;
}

export async function createPresentation(data: {
  item_id: number; brand?: string; description?: string;
  content_quantity: number; content_unit: string;
  sku?: string; reference_price?: number;
}) {
  const result = await query(
    `INSERT INTO inventory_presentations (item_id, brand, description, content_quantity, content_unit, sku, reference_price)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.item_id, data.brand || null, data.description || null,
     data.content_quantity, data.content_unit, data.sku || null, data.reference_price || 0]
  );
  return result.rows[0];
}

export async function updatePresentation(id: number, data: Record<string, any>) {
  const fields = Object.keys(data).filter(k => data[k] !== undefined);
  if (fields.length === 0) return;
  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => data[f]);
  const result = await query(
    `UPDATE inventory_presentations SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0];
}

export async function removePresentation(id: number) {
  await query('UPDATE inventory_presentations SET is_active = false WHERE id = $1', [id]);
}

// Receive by presentation: employee selects presentation + pieces received
export async function receiveByPresentation(userId: number, data: {
  presentation_id: number; pieces: number; reason?: string;
}) {
  const pres = await query('SELECT * FROM inventory_presentations WHERE id = $1', [data.presentation_id]);
  if (!pres.rows[0]) throw new Error('Presentación no encontrada');
  const p = pres.rows[0];

  const totalQty = Number(p.content_quantity) * data.pieces;

  // Log movement
  const reason = data.reason || `Entrada: ${data.pieces} pz ${p.brand || ''} ${p.description || ''} (${p.content_quantity} ${p.content_unit} c/u)`.trim();
  await query(
    `INSERT INTO inventory_movements (item_id, type, quantity, reason, user_id)
     VALUES ($1, 'entrada', $2, $3, $4)`,
    [p.item_id, totalQty, reason, userId]
  );

  // Update stock
  await query('UPDATE inventory_items SET stock = stock + $1 WHERE id = $2', [totalQty, p.item_id]);

  // Update cost if reference price exists
  if (Number(p.reference_price) > 0) {
    const costPerUnit = Number(p.reference_price) / Number(p.content_quantity);
    await query('UPDATE inventory_items SET current_cost = $1 WHERE id = $2', [costPerUnit, p.item_id]);
  }

  const item = await query('SELECT name, stock, unit FROM inventory_items WHERE id = $1', [p.item_id]);
  return {
    message: `+${totalQty} ${p.content_unit} de ${item.rows[0]?.name} (${data.pieces} × ${p.brand || ''} ${p.content_quantity}${p.content_unit})`,
    new_stock: Number(item.rows[0]?.stock),
  };
}

// --- Low stock alerts ---

export async function getLowStock() {
  const result = await query(`
    SELECT i.*,
      (SELECT json_build_object('supplier_name', s.name, 'price', iis.price, 'delivery_days', iis.delivery_days)
       FROM inventory_item_suppliers iis
       JOIN suppliers s ON s.id = iis.supplier_id
       WHERE iis.item_id = i.id ORDER BY iis.price LIMIT 1
      ) as best_supplier
    FROM inventory_items i
    WHERE i.is_active = true AND i.stock <= i.stock_min AND i.stock_min > 0
    ORDER BY (i.stock / NULLIF(i.stock_min, 0)) ASC
  `);
  return result.rows;
}
