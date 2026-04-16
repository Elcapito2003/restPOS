-- ═══════════════════════════════════════════════════════════════
-- PRODUCTIONS MODULE - Producción interna de insumos intermedios
-- ═══════════════════════════════════════════════════════════════

-- 1. Expand movement types to support production and sale deductions
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check
  CHECK (type IN ('entrada', 'salida', 'merma', 'ajuste', 'produccion_entrada', 'produccion_salida', 'venta_salida'));

-- 2. Distinguish insumos from produced items in inventory
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'insumo'
  CHECK (item_type IN ('insumo', 'produccion'));

-- 3. Production catalog (recipe definitions)
CREATE TABLE IF NOT EXISTS productions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  inventory_item_id INT NOT NULL REFERENCES inventory_items(id),
  yield_quantity DECIMAL(10,3) NOT NULL,
  yield_unit VARCHAR(50) NOT NULL,
  estimated_cost DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Recipe ingredients (what insumos are needed per batch)
CREATE TABLE IF NOT EXISTS production_ingredients (
  id SERIAL PRIMARY KEY,
  production_id INT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  inventory_item_id INT NOT NULL REFERENCES inventory_items(id),
  quantity DECIMAL(10,3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  UNIQUE(production_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_ingredients_prod ON production_ingredients(production_id);

-- 5. Production execution logs (traceability)
CREATE TABLE IF NOT EXISTS production_logs (
  id SERIAL PRIMARY KEY,
  production_id INT NOT NULL REFERENCES productions(id),
  production_name VARCHAR(150) NOT NULL,
  batches DECIMAL(10,3) NOT NULL DEFAULT 1,
  total_yield DECIMAL(10,3) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  user_id INT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_logs_prod ON production_logs(production_id);
CREATE INDEX IF NOT EXISTS idx_prod_logs_date ON production_logs(created_at);

-- 6. Snapshot of ingredients used in each production execution
CREATE TABLE IF NOT EXISTS production_log_ingredients (
  id SERIAL PRIMARY KEY,
  production_log_id INT NOT NULL REFERENCES production_logs(id) ON DELETE CASCADE,
  inventory_item_id INT NOT NULL REFERENCES inventory_items(id),
  item_name VARCHAR(150) NOT NULL,
  quantity_used DECIMAL(10,3) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL
);

-- 7. Product recipes (what inventory items a sale product consumes when sold)
CREATE TABLE IF NOT EXISTS product_recipes (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  inventory_item_id INT NOT NULL REFERENCES inventory_items(id),
  quantity DECIMAL(10,3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  UNIQUE(product_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_product_recipes_prod ON product_recipes(product_id);

-- 8. Audit trail for auto-deduction on sale
CREATE TABLE IF NOT EXISTS sale_deduction_logs (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  order_item_id INT REFERENCES order_items(id),
  inventory_item_id INT NOT NULL REFERENCES inventory_items(id),
  quantity_deducted DECIMAL(10,3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_deduct_order ON sale_deduction_logs(order_id);
