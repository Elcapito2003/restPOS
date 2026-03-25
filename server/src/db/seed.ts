import bcrypt from 'bcrypt';
import { pool } from '../config/database';

async function seed() {
  console.log('Seeding database...');

  // Admin user with PIN 1234
  const pin = await bcrypt.hash('1234', 10);
  await pool.query(`
    INSERT INTO users (username, display_name, pin, role, avatar_color)
    VALUES ('admin', 'Administrador', $1, 'admin', '#EF4444')
    ON CONFLICT (username) DO NOTHING
  `, [pin]);

  // Sample waiter
  const waiterPin = await bcrypt.hash('1111', 10);
  await pool.query(`
    INSERT INTO users (username, display_name, pin, role, avatar_color)
    VALUES ('mesero1', 'Carlos', $1, 'waiter', '#3B82F6')
    ON CONFLICT (username) DO NOTHING
  `, [waiterPin]);

  // Sample kitchen user
  const kitchenPin = await bcrypt.hash('2222', 10);
  await pool.query(`
    INSERT INTO users (username, display_name, pin, role, avatar_color)
    VALUES ('cocina', 'Cocina', $1, 'kitchen', '#10B981')
    ON CONFLICT (username) DO NOTHING
  `, [kitchenPin]);

  // Sample cashier
  const cashierPin = await bcrypt.hash('3333', 10);
  await pool.query(`
    INSERT INTO users (username, display_name, pin, role, avatar_color)
    VALUES ('cajero1', 'María', $1, 'cashier', '#F59E0B')
    ON CONFLICT (username) DO NOTHING
  `, [cashierPin]);

  // ======= CATEGORIAS CON JERARQUIA (Grupos y Subgrupos) =======

  // Grupos principales (parent_id = NULL)
  await pool.query(`
    INSERT INTO categories (id, name, parent_id, color, printer_target, sort_order) VALUES
      (1, 'Desayunos', NULL, '#F59E0B', 'kitchen', 1),
      (2, 'Entradas', NULL, '#EF4444', 'kitchen', 2),
      (3, 'Platos Fuertes', NULL, '#DC2626', 'kitchen', 3),
      (4, 'Postres', NULL, '#EC4899', 'kitchen', 4),
      (5, 'Bebidas', NULL, '#3B82F6', 'bar', 5),
      (6, 'Cocteles', NULL, '#8B5CF6', 'bar', 6)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, parent_id=EXCLUDED.parent_id, color=EXCLUDED.color, printer_target=EXCLUDED.printer_target, sort_order=EXCLUDED.sort_order
  `);

  // Subgrupos de Bebidas
  await pool.query(`
    INSERT INTO categories (id, name, parent_id, color, printer_target, sort_order) VALUES
      (10, 'Bebidas Frías', 5, '#3B82F6', 'bar', 1),
      (11, 'Bebidas Calientes', 5, '#B45309', 'bar', 2)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, parent_id=EXCLUDED.parent_id, color=EXCLUDED.color, printer_target=EXCLUDED.printer_target, sort_order=EXCLUDED.sort_order
  `);

  // Sub-subgrupos por tamaño
  await pool.query(`
    INSERT INTO categories (id, name, parent_id, color, printer_target, sort_order) VALUES
      (20, '10 oz', 10, '#3B82F6', 'bar', 1),
      (21, '12 oz', 10, '#2563EB', 'bar', 2),
      (22, '16 oz', 10, '#1D4ED8', 'bar', 3),
      (23, '10 oz', 11, '#B45309', 'bar', 1),
      (24, '12 oz', 11, '#92400E', 'bar', 2),
      (25, '16 oz', 11, '#78350F', 'bar', 3)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, parent_id=EXCLUDED.parent_id, color=EXCLUDED.color, printer_target=EXCLUDED.printer_target, sort_order=EXCLUDED.sort_order
  `);

  // Reset sequence
  await pool.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);

  // Sample products
  await pool.query(`DELETE FROM order_item_modifiers`);
  await pool.query(`DELETE FROM order_items`);
  await pool.query(`DELETE FROM product_modifier_groups`);
  await pool.query(`DELETE FROM products`);
  await pool.query(`
    INSERT INTO products (id, name, price, category_id, sort_order) VALUES
      (1, 'Chilaquiles Verdes', 95.00, 1, 1),
      (2, 'Chilaquiles Rojos', 95.00, 1, 2),
      (3, 'Huevos Rancheros', 85.00, 1, 3),
      (4, 'Hotcakes', 75.00, 1, 4),
      (5, 'Guacamole', 89.00, 2, 1),
      (6, 'Quesadillas', 75.00, 2, 2),
      (7, 'Nachos con Queso', 95.00, 2, 3),
      (8, 'Arrachera', 245.00, 3, 1),
      (9, 'Pollo a la Parrilla', 185.00, 3, 2),
      (10, 'Salmon', 275.00, 3, 3),
      (11, 'Tacos de Pastor (3)', 120.00, 3, 4),
      (12, 'Flan Napolitano', 65.00, 4, 1),
      (13, 'Pastel de Chocolate', 75.00, 4, 2),
      (14, 'Coca Cola 10oz', 30.00, 20, 1),
      (15, 'Coca Cola 12oz', 35.00, 21, 1),
      (16, 'Coca Cola 16oz', 45.00, 22, 1),
      (17, 'Limonada 10oz', 35.00, 20, 2),
      (18, 'Limonada 12oz', 40.00, 21, 2),
      (19, 'Limonada 16oz', 50.00, 22, 2),
      (20, 'Agua Natural', 25.00, 20, 3),
      (21, 'Cerveza Nacional', 55.00, 20, 4),
      (22, 'Café Americano 10oz', 35.00, 23, 1),
      (23, 'Café Americano 12oz', 40.00, 24, 1),
      (24, 'Café Americano 16oz', 50.00, 25, 1),
      (25, 'Cappuccino 12oz', 55.00, 24, 2),
      (26, 'Chocolate Caliente 12oz', 45.00, 24, 3),
      (27, 'Margarita', 120.00, 6, 1),
      (28, 'Piña Colada', 130.00, 6, 2)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price, category_id=EXCLUDED.category_id, sort_order=EXCLUDED.sort_order
  `);
  await pool.query(`SELECT setval('products_id_seq', (SELECT MAX(id) FROM products))`);

  // Modifier groups
  await pool.query(`
    INSERT INTO modifier_groups (name, min_select, max_select, is_required) VALUES
      ('Término de Carne', 1, 1, true),
      ('Extras', 0, 3, false),
      ('Tipo de Agua', 1, 1, true)
    ON CONFLICT DO NOTHING
  `);

  // Modifiers
  await pool.query(`
    INSERT INTO modifiers (group_id, name, price_extra, sort_order) VALUES
      (1, 'Rojo/Crudo', 0, 1),
      (1, 'Medio', 0, 2),
      (1, 'Tres Cuartos', 0, 3),
      (1, 'Bien Cocido', 0, 4),
      (2, 'Extra Queso', 25.00, 1),
      (2, 'Extra Guacamole', 30.00, 2),
      (2, 'Extra Jalapeños', 15.00, 3),
      (3, 'Natural', 0, 1),
      (3, 'Mineral', 0, 2)
    ON CONFLICT DO NOTHING
  `);

  // Link modifiers to products
  await pool.query(`
    INSERT INTO product_modifier_groups (product_id, group_id) VALUES
      (8, 1), (9, 1),
      (5, 2), (6, 2), (7, 2), (8, 2),
      (20, 3)
    ON CONFLICT DO NOTHING
  `);

  // ======= PISO Y MESAS: 8 mesas + 3 barras, solo Interior =======
  await pool.query(`DELETE FROM tables`);
  await pool.query(`DELETE FROM floors`);

  await pool.query(`
    INSERT INTO floors (id, name, sort_order) VALUES
      (1, 'Interior', 1)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name
  `);

  await pool.query(`
    INSERT INTO tables (floor_id, label, capacity, pos_x, pos_y, shape, width, height) VALUES
      (1, '1', 4, 50, 50, 'square', 90, 90),
      (1, '2', 4, 200, 50, 'square', 90, 90),
      (1, '3', 4, 350, 50, 'square', 90, 90),
      (1, '4', 4, 500, 50, 'square', 90, 90),
      (1, '5', 4, 50, 200, 'square', 90, 90),
      (1, '6', 4, 200, 200, 'square', 90, 90),
      (1, '7', 4, 350, 200, 'square', 90, 90),
      (1, '8', 4, 500, 200, 'square', 90, 90),
      (1, 'B1', 2, 50, 380, 'rect', 120, 60),
      (1, 'B2', 2, 230, 380, 'rect', 120, 60),
      (1, 'B3', 2, 410, 380, 'rect', 120, 60)
  `);

  console.log('Seeding completed.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
