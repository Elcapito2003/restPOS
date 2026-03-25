import { query, getClient } from '../../config/database';

export async function getAll() {
  const groups = await query('SELECT * FROM modifier_groups ORDER BY name');
  for (const g of groups.rows) {
    const mods = await query('SELECT * FROM modifiers WHERE group_id = $1 ORDER BY sort_order', [g.id]);
    g.modifiers = mods.rows;
    const products = await query('SELECT product_id FROM product_modifier_groups WHERE group_id = $1', [g.id]);
    g.product_ids = products.rows.map((r: any) => r.product_id);
  }
  return groups.rows;
}

export async function getById(id: number) {
  const result = await query('SELECT * FROM modifier_groups WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  const g = result.rows[0];
  const mods = await query('SELECT * FROM modifiers WHERE group_id = $1 ORDER BY sort_order', [id]);
  g.modifiers = mods.rows;
  const products = await query('SELECT product_id FROM product_modifier_groups WHERE group_id = $1', [id]);
  g.product_ids = products.rows.map((r: any) => r.product_id);
  return g;
}

export async function create(data: any) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO modifier_groups (name, min_select, max_select, is_required) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.name, data.min_select ?? 0, data.max_select ?? 1, data.is_required ?? false]
    );
    const group = result.rows[0];

    if (data.modifiers?.length) {
      for (const mod of data.modifiers) {
        await client.query(
          'INSERT INTO modifiers (group_id, name, price_extra, sort_order) VALUES ($1, $2, $3, $4)',
          [group.id, mod.name, mod.price_extra ?? 0, mod.sort_order ?? 0]
        );
      }
    }

    if (data.product_ids?.length) {
      for (const pid of data.product_ids) {
        await client.query(
          'INSERT INTO product_modifier_groups (product_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [pid, group.id]
        );
      }
    }

    await client.query('COMMIT');
    return getById(group.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function update(id: number, data: any) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (data.name || data.min_select !== undefined || data.max_select !== undefined || data.is_required !== undefined) {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }
      if (data.min_select !== undefined) { fields.push(`min_select = $${idx++}`); values.push(data.min_select); }
      if (data.max_select !== undefined) { fields.push(`max_select = $${idx++}`); values.push(data.max_select); }
      if (data.is_required !== undefined) { fields.push(`is_required = $${idx++}`); values.push(data.is_required); }
      values.push(id);
      await client.query(`UPDATE modifier_groups SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    if (data.modifiers) {
      await client.query('DELETE FROM modifiers WHERE group_id = $1', [id]);
      for (const mod of data.modifiers) {
        await client.query(
          'INSERT INTO modifiers (group_id, name, price_extra, sort_order) VALUES ($1, $2, $3, $4)',
          [id, mod.name, mod.price_extra ?? 0, mod.sort_order ?? 0]
        );
      }
    }

    if (data.product_ids) {
      // Remove links NOT in the new list, but preserve is_forced/sort_order for remaining
      await client.query(
        'DELETE FROM product_modifier_groups WHERE group_id = $1 AND product_id != ALL($2)',
        [id, data.product_ids]
      );
      for (const pid of data.product_ids) {
        await client.query(
          'INSERT INTO product_modifier_groups (product_id, group_id) VALUES ($1, $2) ON CONFLICT (product_id, group_id) DO NOTHING',
          [pid, id]
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
  await query('DELETE FROM modifier_groups WHERE id = $1', [id]);
}
