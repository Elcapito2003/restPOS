import { query, getClient } from '../../config/database';

// ─── Read ───

export async function getAll() {
  const result = await query(`
    SELECT p.*, ii.stock as current_stock, ii.unit as inv_unit, ii.current_cost,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', pi.id, 'inventory_item_id', pi.inventory_item_id,
          'item_name', i.name, 'quantity', pi.quantity, 'unit', pi.unit,
          'item_stock', i.stock, 'item_cost', i.current_cost
        ) ORDER BY pi.id)
        FROM production_ingredients pi
        JOIN inventory_items i ON i.id = pi.inventory_item_id
        WHERE pi.production_id = p.id
      ), '[]'::json) as ingredients
    FROM productions p
    JOIN inventory_items ii ON ii.id = p.inventory_item_id
    WHERE p.is_active = true
    ORDER BY p.name
  `);
  return result.rows;
}

export async function getById(id: number) {
  const result = await query(`
    SELECT p.*, ii.stock as current_stock, ii.unit as inv_unit, ii.current_cost,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', pi.id, 'inventory_item_id', pi.inventory_item_id,
          'item_name', i.name, 'quantity', pi.quantity, 'unit', pi.unit,
          'item_stock', i.stock, 'item_cost', i.current_cost
        ) ORDER BY pi.id)
        FROM production_ingredients pi
        JOIN inventory_items i ON i.id = pi.inventory_item_id
        WHERE pi.production_id = p.id
      ), '[]'::json) as ingredients
    FROM productions p
    JOIN inventory_items ii ON ii.id = p.inventory_item_id
    WHERE p.id = $1
  `, [id]);
  return result.rows[0];
}

// ─── Create ───

export async function create(data: {
  name: string; yield_quantity: number; yield_unit: string; notes?: string;
  ingredients: { inventory_item_id: number; quantity: number; unit: string }[];
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Create the output inventory item (type 'produccion')
    const invResult = await client.query(
      `INSERT INTO inventory_items (name, unit, item_type, stock, stock_min)
       VALUES ($1, $2, 'produccion', 0, 0) RETURNING id`,
      [data.name, data.yield_unit]
    );
    const inventoryItemId = invResult.rows[0].id;

    // Validate ingredients are insumos only
    for (const ing of data.ingredients) {
      const check = await client.query(
        `SELECT id, item_type FROM inventory_items WHERE id = $1 AND is_active = true`,
        [ing.inventory_item_id]
      );
      if (!check.rows[0]) throw new Error(`Insumo con id ${ing.inventory_item_id} no encontrado`);
      if (check.rows[0].item_type !== 'insumo') throw new Error(`"${ing.inventory_item_id}" no es un insumo, no se puede usar como ingrediente`);
    }

    // Calculate estimated cost
    let estimatedCost = 0;
    for (const ing of data.ingredients) {
      const item = await client.query('SELECT current_cost FROM inventory_items WHERE id = $1', [ing.inventory_item_id]);
      estimatedCost += ing.quantity * Number(item.rows[0]?.current_cost || 0);
    }
    const costPerUnit = data.yield_quantity > 0 ? estimatedCost / data.yield_quantity : 0;

    // Create production
    const prodResult = await client.query(
      `INSERT INTO productions (name, inventory_item_id, yield_quantity, yield_unit, estimated_cost, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.name, inventoryItemId, data.yield_quantity, data.yield_unit, costPerUnit, data.notes || null]
    );
    const productionId = prodResult.rows[0].id;

    // Insert ingredients
    for (const ing of data.ingredients) {
      await client.query(
        `INSERT INTO production_ingredients (production_id, inventory_item_id, quantity, unit)
         VALUES ($1, $2, $3, $4)`,
        [productionId, ing.inventory_item_id, ing.quantity, ing.unit]
      );
    }

    await client.query('COMMIT');
    return getById(productionId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Update ───

export async function update(id: number, data: {
  name?: string; yield_quantity?: number; yield_unit?: string; notes?: string;
  ingredients?: { inventory_item_id: number; quantity: number; unit: string }[];
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM productions WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new Error('Producción no encontrada');

    // Update production fields
    if (data.name !== undefined) {
      await client.query('UPDATE productions SET name = $1, updated_at = NOW() WHERE id = $2', [data.name, id]);
      await client.query('UPDATE inventory_items SET name = $1 WHERE id = $2', [data.name, existing.rows[0].inventory_item_id]);
    }
    if (data.yield_quantity !== undefined) {
      await client.query('UPDATE productions SET yield_quantity = $1, updated_at = NOW() WHERE id = $2', [data.yield_quantity, id]);
    }
    if (data.yield_unit !== undefined) {
      await client.query('UPDATE productions SET yield_unit = $1, updated_at = NOW() WHERE id = $2', [data.yield_unit, id]);
      await client.query('UPDATE inventory_items SET unit = $1 WHERE id = $2', [data.yield_unit, existing.rows[0].inventory_item_id]);
    }
    if (data.notes !== undefined) {
      await client.query('UPDATE productions SET notes = $1, updated_at = NOW() WHERE id = $2', [data.notes, id]);
    }

    // Replace ingredients if provided
    if (data.ingredients) {
      for (const ing of data.ingredients) {
        const check = await client.query('SELECT item_type FROM inventory_items WHERE id = $1 AND is_active = true', [ing.inventory_item_id]);
        if (!check.rows[0]) throw new Error(`Insumo con id ${ing.inventory_item_id} no encontrado`);
        if (check.rows[0].item_type !== 'insumo') throw new Error(`Solo se pueden usar insumos como ingredientes`);
      }

      await client.query('DELETE FROM production_ingredients WHERE production_id = $1', [id]);
      for (const ing of data.ingredients) {
        await client.query(
          'INSERT INTO production_ingredients (production_id, inventory_item_id, quantity, unit) VALUES ($1,$2,$3,$4)',
          [id, ing.inventory_item_id, ing.quantity, ing.unit]
        );
      }

      // Recalculate estimated cost
      let estimatedCost = 0;
      for (const ing of data.ingredients) {
        const item = await client.query('SELECT current_cost FROM inventory_items WHERE id = $1', [ing.inventory_item_id]);
        estimatedCost += ing.quantity * Number(item.rows[0]?.current_cost || 0);
      }
      const yieldQty = data.yield_quantity || Number(existing.rows[0].yield_quantity);
      const costPerUnit = yieldQty > 0 ? estimatedCost / yieldQty : 0;
      await client.query('UPDATE productions SET estimated_cost = $1, updated_at = NOW() WHERE id = $2', [costPerUnit, id]);
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

// ─── Remove ───

export async function remove(id: number) {
  await query('UPDATE productions SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
}

// ─── Execute Production ───

export async function execute(userId: number, productionId: number, data: {
  batches: number; notes?: string;
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Load production + ingredients
    const prodResult = await client.query(`
      SELECT p.*, ii.stock as output_stock, ii.current_cost as output_cost
      FROM productions p
      JOIN inventory_items ii ON ii.id = p.inventory_item_id
      WHERE p.id = $1 AND p.is_active = true
    `, [productionId]);
    if (!prodResult.rows[0]) throw new Error('Producción no encontrada');
    const prod = prodResult.rows[0];

    const ingResult = await client.query(`
      SELECT pi.*, i.name as item_name, i.stock as item_stock, i.current_cost as item_cost, i.unit as item_unit
      FROM production_ingredients pi
      JOIN inventory_items i ON i.id = pi.inventory_item_id
      WHERE pi.production_id = $1
    `, [productionId]);
    const ingredients = ingResult.rows;

    // Validate stock for all ingredients
    const shortages: string[] = [];
    for (const ing of ingredients) {
      const needed = Number(ing.quantity) * data.batches;
      if (Number(ing.item_stock) < needed) {
        shortages.push(`${ing.item_name}: necesitas ${needed} ${ing.unit}, tienes ${Number(ing.item_stock)}`);
      }
    }
    if (shortages.length > 0) {
      throw new Error(`Stock insuficiente:\n${shortages.join('\n')}`);
    }

    // Deduct ingredients
    let totalCost = 0;
    const logIngredients: any[] = [];

    for (const ing of ingredients) {
      const qty = Number(ing.quantity) * data.batches;
      const unitCost = Number(ing.item_cost || 0);
      totalCost += qty * unitCost;

      // Deduct stock
      await client.query('UPDATE inventory_items SET stock = stock - $1 WHERE id = $2', [qty, ing.inventory_item_id]);

      // Log movement
      await client.query(
        `INSERT INTO inventory_movements (item_id, type, quantity, reason, user_id)
         VALUES ($1, 'produccion_salida', $2, $3, $4)`,
        [ing.inventory_item_id, qty, `Producción: ${prod.name} x${data.batches}`, userId]
      );

      logIngredients.push({
        inventory_item_id: ing.inventory_item_id,
        item_name: ing.item_name,
        quantity_used: qty,
        unit_cost: unitCost,
        unit: ing.unit,
      });
    }

    // Add produced output to inventory
    const totalYield = Number(prod.yield_quantity) * data.batches;
    const costPerUnit = totalYield > 0 ? totalCost / totalYield : 0;

    // Weighted average cost
    const oldStock = Number(prod.output_stock);
    const oldCost = Number(prod.output_cost || 0);
    const newStock = oldStock + totalYield;
    const newCost = newStock > 0 ? (oldStock * oldCost + totalYield * costPerUnit) / newStock : costPerUnit;

    await client.query(
      'UPDATE inventory_items SET stock = stock + $1, current_cost = $2 WHERE id = $3',
      [totalYield, newCost, prod.inventory_item_id]
    );

    // Log entry movement
    await client.query(
      `INSERT INTO inventory_movements (item_id, type, quantity, reason, user_id)
       VALUES ($1, 'produccion_entrada', $2, $3, $4)`,
      [prod.inventory_item_id, totalYield, `Producción: ${prod.name} x${data.batches}`, userId]
    );

    // Update estimated cost on production
    await client.query('UPDATE productions SET estimated_cost = $1, updated_at = NOW() WHERE id = $2', [costPerUnit, productionId]);

    // Log the execution
    const logResult = await client.query(
      `INSERT INTO production_logs (production_id, production_name, batches, total_yield, total_cost, user_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [productionId, prod.name, data.batches, totalYield, totalCost, userId, data.notes || null]
    );
    const logId = logResult.rows[0].id;

    // Log ingredients snapshot
    for (const li of logIngredients) {
      await client.query(
        `INSERT INTO production_log_ingredients (production_log_id, inventory_item_id, item_name, quantity_used, unit_cost, unit)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [logId, li.inventory_item_id, li.item_name, li.quantity_used, li.unit_cost, li.unit]
      );
    }

    await client.query('COMMIT');

    return {
      log: logResult.rows[0],
      ingredients_used: logIngredients,
      total_yield: totalYield,
      total_cost: totalCost,
      cost_per_unit: costPerUnit,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Logs ───

export async function getLogs(limit = 50) {
  const result = await query(`
    SELECT pl.*, u.display_name as user_name,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'item_name', pli.item_name, 'quantity_used', pli.quantity_used,
          'unit_cost', pli.unit_cost, 'unit', pli.unit
        ) ORDER BY pli.id)
        FROM production_log_ingredients pli WHERE pli.production_log_id = pl.id
      ), '[]'::json) as ingredients
    FROM production_logs pl
    LEFT JOIN users u ON u.id = pl.user_id
    ORDER BY pl.created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}
