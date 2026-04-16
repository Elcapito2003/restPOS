import { query, getClient } from '../../config/database';

// ─── Recipe CRUD ───

export async function getRecipe(productId: number) {
  const result = await query(`
    SELECT pr.*, i.name as item_name, i.unit as item_unit, i.stock as item_stock, i.item_type
    FROM product_recipes pr
    JOIN inventory_items i ON i.id = pr.inventory_item_id
    WHERE pr.product_id = $1
    ORDER BY pr.id
  `, [productId]);
  return result.rows;
}

export async function getProductsWithRecipes() {
  const result = await query(`
    SELECT p.id, p.name, p.price, c.name as category,
      (SELECT COUNT(*) FROM product_recipes pr WHERE pr.product_id = p.id) as recipe_count,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'item_name', i.name, 'quantity', pr.quantity, 'unit', pr.unit, 'item_type', i.item_type
        ) ORDER BY pr.id)
        FROM product_recipes pr JOIN inventory_items i ON i.id = pr.inventory_item_id
        WHERE pr.product_id = p.id
      ), '[]'::json) as recipe
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_available = true
    ORDER BY c.name, p.name
  `);
  return result.rows;
}

export async function setRecipe(productId: number, ingredients: {
  inventory_item_id: number; quantity: number; unit: string;
}[]) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Delete existing recipe
    await client.query('DELETE FROM product_recipes WHERE product_id = $1', [productId]);

    // Insert new ingredients
    for (const ing of ingredients) {
      // Validate inventory item exists (can be insumo or produccion)
      const check = await client.query(
        'SELECT id, item_type FROM inventory_items WHERE id = $1 AND is_active = true',
        [ing.inventory_item_id]
      );
      if (!check.rows[0]) throw new Error(`Insumo/producción con id ${ing.inventory_item_id} no encontrado`);

      await client.query(
        `INSERT INTO product_recipes (product_id, inventory_item_id, quantity, unit)
         VALUES ($1, $2, $3, $4)`,
        [productId, ing.inventory_item_id, ing.quantity, ing.unit]
      );
    }

    await client.query('COMMIT');
    return getRecipe(productId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Auto-deduction on sale ───

export async function deductForOrder(orderId: number) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get all non-cancelled order items
    const itemsResult = await client.query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.product_name as name
       FROM order_items oi
       WHERE oi.order_id = $1 AND oi.status != 'cancelled'`,
      [orderId]
    );

    for (const orderItem of itemsResult.rows) {
      // Get recipe for this product
      const recipeResult = await client.query(
        `SELECT pr.inventory_item_id, pr.quantity, pr.unit, i.name as item_name
         FROM product_recipes pr
         JOIN inventory_items i ON i.id = pr.inventory_item_id
         WHERE pr.product_id = $1`,
        [orderItem.product_id]
      );

      for (const recipe of recipeResult.rows) {
        const qtyToDeduct = Number(recipe.quantity) * Number(orderItem.quantity);

        // Deduct stock (allow negative - don't block sales)
        await client.query(
          'UPDATE inventory_items SET stock = stock - $1 WHERE id = $2',
          [qtyToDeduct, recipe.inventory_item_id]
        );

        // Log movement
        await client.query(
          `INSERT INTO inventory_movements (item_id, type, quantity, reason)
           VALUES ($1, 'venta_salida', $2, $3)`,
          [recipe.inventory_item_id, qtyToDeduct, `Venta orden #${orderId}: ${orderItem.name} x${orderItem.quantity}`]
        );

        // Audit log
        await client.query(
          `INSERT INTO sale_deduction_logs (order_id, order_item_id, inventory_item_id, quantity_deducted, unit)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, orderItem.id, recipe.inventory_item_id, qtyToDeduct, recipe.unit]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[AUTO-DEDUCT] Error deducting for order ${orderId}:`, err);
    // Don't re-throw - sales must never fail because of inventory
  } finally {
    client.release();
  }
}
