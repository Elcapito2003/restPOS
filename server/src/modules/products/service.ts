import { query, getClient } from '../../config/database';
import { getDescendantIds } from '../categories/service';

export async function getAll(categoryId?: number, showAll = false) {
  let sql = `SELECT p.*, c.name as category_name, COALESCE(p.printer_target, c.printer_target) as printer_target
    FROM products p JOIN categories c ON p.category_id = c.id`;
  const conditions: string[] = [];
  const params: any[] = [];
  if (!showAll) {
    conditions.push('p.is_available = true');
  }
  if (categoryId) {
    const ids = await getDescendantIds(categoryId);
    params.push(ids);
    conditions.push(`p.category_id = ANY($${params.length})`);
  }
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' ORDER BY p.sort_order, p.name';
  const result = await query(sql, params);
  return result.rows;
}

export async function getById(id: number) {
  const result = await query(`
    SELECT p.*, c.name as category_name, COALESCE(p.printer_target, c.printer_target) as printer_target
    FROM products p JOIN categories c ON p.category_id = c.id
    WHERE p.id = $1
  `, [id]);
  return result.rows[0] || null;
}

export async function getWithModifiers(id: number) {
  const product = await getById(id);
  if (!product) return null;

  const modGroups = await query(`
    SELECT mg.*, pmg.is_forced, pmg.sort_order AS link_sort_order
    FROM modifier_groups mg
    JOIN product_modifier_groups pmg ON pmg.group_id = mg.id
    WHERE pmg.product_id = $1
    ORDER BY pmg.sort_order, mg.name
  `, [id]);

  for (const group of modGroups.rows) {
    const mods = await query('SELECT * FROM modifiers WHERE group_id = $1 AND is_active = true ORDER BY sort_order', [group.id]);
    group.modifiers = mods.rows;
  }

  return { ...product, modifier_groups: modGroups.rows };
}

interface ModifierGroupLink {
  group_id: number;
  is_forced?: boolean;
  sort_order?: number;
}

interface CreateData {
  name: string;
  price: number;
  tax_rate?: number;
  category_id: number;
  sort_order?: number;
  is_composite?: boolean;
  description?: string;
  printer_target?: string;
  modifier_groups?: ModifierGroupLink[];
}

export async function create(data: CreateData) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO products (name, price, tax_rate, category_id, sort_order, is_composite, description, printer_target)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.name, data.price, data.tax_rate ?? 0.16, data.category_id, data.sort_order || 0,
       data.is_composite ?? false, data.description || null, data.printer_target || null]
    );
    const product = result.rows[0];

    if (data.modifier_groups?.length) {
      for (const mg of data.modifier_groups) {
        await client.query(
          `INSERT INTO product_modifier_groups (product_id, group_id, is_forced, sort_order)
           VALUES ($1, $2, $3, $4) ON CONFLICT (product_id, group_id) DO NOTHING`,
          [product.id, mg.group_id, mg.is_forced ?? false, mg.sort_order ?? 0]
        );
      }
    }

    await client.query('COMMIT');
    return product;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

interface UpdateData {
  name?: string;
  price?: number;
  tax_rate?: number;
  category_id?: number;
  is_available?: boolean;
  sort_order?: number;
  is_composite?: boolean;
  description?: string;
  printer_target?: string;
  modifier_groups?: ModifierGroupLink[];
}

export async function update(id: number, data: UpdateData) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.price !== undefined) { fields.push(`price = $${idx++}`); values.push(data.price); }
    if (data.tax_rate !== undefined) { fields.push(`tax_rate = $${idx++}`); values.push(data.tax_rate); }
    if (data.category_id) { fields.push(`category_id = $${idx++}`); values.push(data.category_id); }
    if (data.is_available !== undefined) { fields.push(`is_available = $${idx++}`); values.push(data.is_available); }
    if (data.sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(data.sort_order); }
    if (data.is_composite !== undefined) { fields.push(`is_composite = $${idx++}`); values.push(data.is_composite); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.printer_target !== undefined) { fields.push(`printer_target = $${idx++}`); values.push(data.printer_target || null); }

    if (fields.length > 0) {
      fields.push('updated_at = NOW()');
      values.push(id);
      await client.query(`UPDATE products SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    // Full-replace modifier group links when provided
    if (data.modifier_groups !== undefined) {
      await client.query('DELETE FROM product_modifier_groups WHERE product_id = $1', [id]);
      for (const mg of data.modifier_groups) {
        await client.query(
          `INSERT INTO product_modifier_groups (product_id, group_id, is_forced, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [id, mg.group_id, mg.is_forced ?? false, mg.sort_order ?? 0]
        );
      }
    }

    await client.query('COMMIT');
    return getById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function remove(id: number) {
  await query('UPDATE products SET is_available = false WHERE id = $1', [id]);
}
