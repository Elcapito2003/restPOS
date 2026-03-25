import { query } from '../../config/database';

export async function getAll() {
  const result = await query('SELECT * FROM categories WHERE is_active = true ORDER BY sort_order, name');
  return result.rows;
}

// Returns tree structure: top-level groups with nested children
export async function getTree() {
  const all = await getAll();
  const map = new Map<number, any>();
  for (const cat of all) {
    map.set(cat.id, { ...cat, children: [] });
  }
  const roots: any[] = [];
  for (const cat of map.values()) {
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id).children.push(cat);
    } else {
      roots.push(cat);
    }
  }
  return roots;
}

// Returns all leaf category IDs under a given parent (recursive)
export async function getDescendantIds(parentId: number): Promise<number[]> {
  const all = await getAll();
  const ids: number[] = [];
  function collect(pid: number) {
    for (const cat of all) {
      if (cat.parent_id === pid) {
        ids.push(cat.id);
        collect(cat.id);
      }
    }
  }
  collect(parentId);
  // If no children, the parent itself is a leaf
  if (ids.length === 0) ids.push(parentId);
  return ids;
}

export async function getById(id: number) {
  const result = await query('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function create(data: { name: string; parent_id?: number; color?: string; printer_target?: string; sort_order?: number }) {
  const result = await query(
    'INSERT INTO categories (name, parent_id, color, printer_target, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [data.name, data.parent_id || null, data.color || '#6366F1', data.printer_target || 'kitchen', data.sort_order || 0]
  );
  return result.rows[0];
}

export async function update(id: number, data: Partial<{ name: string; parent_id: number | null; color: string; printer_target: string; sort_order: number; is_active: boolean }>) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.parent_id !== undefined) { fields.push(`parent_id = $${idx++}`); values.push(data.parent_id); }
  if (data.color) { fields.push(`color = $${idx++}`); values.push(data.color); }
  if (data.printer_target) { fields.push(`printer_target = $${idx++}`); values.push(data.printer_target); }
  if (data.sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(data.sort_order); }
  if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }

  if (fields.length === 0) return getById(id);
  values.push(id);

  const result = await query(`UPDATE categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
  return result.rows[0];
}

export async function remove(id: number) {
  await query('UPDATE categories SET is_active = false WHERE id = $1', [id]);
}
