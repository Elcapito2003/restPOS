import { Router, Request, Response } from 'express';
import { env } from '../../config/env';
import { query } from '../../config/database';

const router = Router();

const AGENT_KEY = env.openclawToken;

function agentAuth(req: Request, res: Response, next: () => void) {
  const key = req.headers['x-agent-key'] || req.query.key;
  if (key !== AGENT_KEY) return res.status(403).json({ error: 'Invalid agent key' });
  next();
}

router.use(agentAuth);

const h = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response) => fn(req, res).catch((err: any) => res.status(500).json({ error: err.message }));

// ─── Inventory ───

router.get('/inventory', h(async (req, res) => {
  const search = req.query.search as string;
  const lowStock = req.query.low_stock === 'true';
  let sql = `SELECT name, stock, stock_min, unit, current_cost FROM inventory_items WHERE is_active=true`;
  const params: any[] = [];
  if (search) { params.push(`%${search}%`); sql += ` AND name ILIKE $${params.length}`; }
  if (lowStock) sql += ` AND stock <= stock_min AND stock_min > 0`;
  sql += ' ORDER BY name LIMIT 50';
  const r = await query(sql, params);
  res.json(r.rows);
}));

router.post('/inventory/adjust', h(async (req, res) => {
  const { item_name, type, quantity, reason } = req.body;
  const item = await query(`SELECT id, name, stock, unit FROM inventory_items WHERE is_active=true AND name ILIKE $1 LIMIT 1`, [`%${item_name}%`]);
  if (!item.rows[0]) return res.status(404).json({ error: `No se encontró "${item_name}"` });
  const i = item.rows[0];
  const qty = type === 'entrada' || type === 'ajuste' ? Math.abs(quantity) : -Math.abs(quantity);
  await query(`INSERT INTO inventory_movements(item_id,type,quantity,reason) VALUES($1,$2,$3,$4)`, [i.id, type, Math.abs(quantity), reason || null]);
  const newStock = Math.max(0, Number(i.stock) + qty);
  await query(`UPDATE inventory_items SET stock=$1 WHERE id=$2`, [newStock, i.id]);
  res.json({ message: `${type}: ${quantity} ${i.unit} de ${i.name}. Stock: ${newStock}` });
}));

// ─── Products ───

router.get('/products', h(async (req, res) => {
  const search = req.query.search as string;
  let sql = `SELECT p.name, p.price, p.is_available, c.name as category FROM products p JOIN categories c ON c.id=p.category_id`;
  const params: any[] = [];
  if (search) { params.push(`%${search}%`); sql += ` WHERE p.name ILIKE $${params.length}`; }
  sql += ' ORDER BY p.name LIMIT 30';
  const r = await query(sql, params);
  res.json(r.rows);
}));

router.post('/products/update', h(async (req, res) => {
  const { name, price, is_available } = req.body;
  const prod = await query(`SELECT id, name, price, is_available FROM products WHERE name ILIKE $1 LIMIT 1`, [`%${name}%`]);
  if (!prod.rows[0]) return res.status(404).json({ error: `No se encontró "${name}"` });
  const p = prod.rows[0];
  const updates: string[] = []; const params: any[] = [p.id];
  if (price !== undefined) { params.push(price); updates.push(`price=$${params.length}`); }
  if (is_available !== undefined) { params.push(is_available); updates.push(`is_available=$${params.length}`); }
  if (!updates.length) return res.json({ message: 'Sin cambios' });
  updates.push('updated_at=NOW()');
  await query(`UPDATE products SET ${updates.join(',')} WHERE id=$1`, params);
  res.json({ message: `"${p.name}" actualizado`, antes: { precio: p.price, disponible: p.is_available } });
}));

router.post('/products/create', h(async (req, res) => {
  const { name, price, category_name } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name y price requeridos' });
  let catId = null;
  if (category_name) {
    const cat = await query(`SELECT id FROM categories WHERE name ILIKE $1 AND is_active=true LIMIT 1`, [`%${category_name}%`]);
    catId = cat.rows[0]?.id;
    if (!catId) {
      const newCat = await query(`INSERT INTO categories(name) VALUES($1) RETURNING id`, [category_name]);
      catId = newCat.rows[0].id;
    }
  }
  if (!catId) return res.status(400).json({ error: 'category_name requerido' });
  const r = await query(`INSERT INTO products(name,price,category_id) VALUES($1,$2,$3) RETURNING id,name,price`, [name, price, catId]);
  res.json({ message: `Producto "${r.rows[0].name}" creado ($${r.rows[0].price})`, product: r.rows[0] });
}));

// ─── Sales ───

router.get('/sales/today', h(async (_req, res) => {
  const sales = await query(`SELECT COUNT(*) as ordenes, COALESCE(SUM(total),0) as venta, COALESCE(AVG(total),0) as ticket FROM orders WHERE status='closed' AND DATE(created_at)=CURRENT_DATE`);
  const top = await query(`SELECT oi.product_name, SUM(oi.quantity) as qty, SUM(oi.unit_price * oi.quantity) as total FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='closed' AND DATE(o.created_at)=CURRENT_DATE GROUP BY oi.product_name ORDER BY qty DESC LIMIT 10`);
  res.json({ ...sales.rows[0], top_productos: top.rows });
}));

// ─── Suppliers ───

router.get('/suppliers', h(async (req, res) => {
  const search = req.query.search as string;
  let sql = `SELECT name, whatsapp, phone FROM suppliers WHERE is_active=true`;
  const params: any[] = [];
  if (search) { params.push(`%${search}%`); sql += ` AND name ILIKE $${params.length}`; }
  sql += ' ORDER BY name';
  const r = await query(sql, params);
  res.json(r.rows);
}));

// ─── Contact lookup (identify WhatsApp sender) ───
router.get('/contact-lookup', h(async (req, res) => {
  const raw = String(req.query.phone || '').replace(/\D/g, '');
  if (!raw) return res.status(400).json({ error: 'phone requerido' });

  // Owner: Antonio (DUO Café)
  if (raw.endsWith('3313283362')) {
    return res.json({ type: 'owner', name: 'Antonio', role: 'admin', business: 'DUO Café' });
  }

  // Supplier match: phone or whatsapp column ends with same digits (last 10)
  const tail10 = raw.slice(-10);
  const sup = await query(
    `SELECT s.id, s.name, s.contact_name, s.whatsapp, s.phone, s.email, s.shipping_cost, s.free_shipping_min,
       COALESCE(
         (SELECT json_agg(json_build_object('item', ii.name, 'unit', ii.unit, 'price', iis.price, 'delivery_days', iis.delivery_days))
          FROM inventory_item_suppliers iis JOIN inventory_items ii ON ii.id = iis.item_id
          WHERE iis.supplier_id = s.id), '[]'::json) as items
     FROM suppliers s
     WHERE s.is_active = true
       AND (regexp_replace(COALESCE(s.whatsapp, ''), '\\D', '', 'g') LIKE '%' || $1
         OR regexp_replace(COALESCE(s.phone, ''), '\\D', '', 'g') LIKE '%' || $1)
     LIMIT 1`,
    [tail10]
  );
  if (sup.rows[0]) {
    return res.json({ type: 'supplier', ...sup.rows[0] });
  }
  res.json({ type: 'unknown', phone_normalized: raw });
}));

// ─── Supplier orders: create from agent ───
router.post('/supplier-orders', h(async (req, res) => {
  const { supplier_name, items, notes } = req.body;
  if (!supplier_name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'supplier_name e items[] requeridos' });
  }
  const sup = await query(`SELECT id, name FROM suppliers WHERE is_active=true AND name ILIKE $1 LIMIT 1`, [`%${supplier_name}%`]);
  if (!sup.rows[0]) return res.status(404).json({ error: `Proveedor "${supplier_name}" no encontrado` });

  const est = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);
  const order = await query(
    `INSERT INTO supplier_orders(supplier_id, status, estimated_total, notes) VALUES($1, 'draft', $2, $3) RETURNING id`,
    [sup.rows[0].id, est, notes || null]
  );
  const orderId = order.rows[0].id;
  for (const it of items) {
    await query(
      `INSERT INTO supplier_order_items(order_id, item_name, quantity, unit, estimated_price) VALUES($1, $2, $3, $4, $5)`,
      [orderId, it.item, Number(it.quantity) || 0, it.unit || 'pieza', Number(it.price) || null]
    );
  }
  res.json({ message: `Pedido #${orderId} creado para ${sup.rows[0].name}`, order_id: orderId, estimated_total: est });
}));

// ─── ML Requests ───

router.post('/ml-request', h(async (req, res) => {
  const { product_description, quantity, max_price, priority, requested_by, notes, search_query } = req.body;
  if (!product_description) return res.status(400).json({ error: 'product_description requerido' });
  const r = await query(
    `INSERT INTO ml_requests(product_description,quantity,max_price,priority,requested_by,notes,search_query) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [product_description, quantity || 1, max_price || null, priority || 'normal', requested_by || null, notes || null, search_query || product_description]
  );
  res.json({ message: `Solicitud creada: "${product_description}" x${quantity || 1}`, request: r.rows[0] });
}));

// ─── Expenses ───

router.get('/expenses', h(async (req, res) => {
  const days = Number(req.query.days) || 7;
  const r = await query(`SELECT description, amount, created_at FROM expenses WHERE created_at>=NOW()-make_interval(days=>$1) ORDER BY created_at DESC LIMIT 30`, [days]);
  const total = await query(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE created_at>=NOW()-make_interval(days=>$1)`, [days]);
  res.json({ total: total.rows[0].total, gastos: r.rows });
}));

// ─── Orders ───

router.get('/orders', h(async (req, res) => {
  const status = req.query.status as string;
  let sql = `SELECT o.id, s.name as proveedor, o.status, o.estimated_total, o.created_at FROM supplier_orders o JOIN suppliers s ON s.id=o.supplier_id`;
  const params: any[] = [];
  if (status) { params.push(status); sql += ` WHERE o.status=$${params.length}`; }
  sql += ' ORDER BY o.created_at DESC LIMIT 20';
  const r = await query(sql, params);
  res.json(r.rows);
}));

// ─── Memory ───

router.post('/memory', h(async (req, res) => {
  const { session_id, fact, category } = req.body;
  await query(`INSERT INTO chatbot_memory(session_id,fact,category) VALUES($1,$2,$3)`, [session_id || 'agent', fact, category || 'context']);
  res.json({ message: `Memorizado: "${fact}"` });
}));

router.get('/memory', h(async (req, res) => {
  const session = req.query.session_id || 'agent';
  const r = await query(`SELECT fact, category, created_at FROM chatbot_memory WHERE session_id=$1 ORDER BY created_at DESC LIMIT 20`, [session]);
  res.json(r.rows);
}));

export default router;
