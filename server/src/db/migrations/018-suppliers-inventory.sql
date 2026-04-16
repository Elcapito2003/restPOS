-- Proveedores (Suppliers)
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_name VARCHAR(150),
  phone VARCHAR(30),
  address TEXT,
  bank_name VARCHAR(100),
  account_number VARCHAR(30),
  clabe VARCHAR(20),
  email VARCHAR(100),
  whatsapp VARCHAR(20),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Items (Raw materials / Insumos)
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  units_per_package INT DEFAULT 1,
  unit_content VARCHAR(50),
  current_cost DECIMAL(10,2) DEFAULT 0,
  stock DECIMAL(10,3) DEFAULT 0,
  stock_min DECIMAL(10,3) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item-Supplier relationship (many-to-many with pricing)
CREATE TABLE IF NOT EXISTS inventory_item_suppliers (
  id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  price DECIMAL(10,2) DEFAULT 0,
  delivery_days INT DEFAULT 1,
  UNIQUE(item_id, supplier_id)
);

-- Inventory movements (audit trail)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('entrada', 'salida', 'merma', 'ajuste')),
  quantity DECIMAL(10,3) NOT NULL,
  reason TEXT,
  user_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases (Compras)
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES inventory_items(id),
  supplier_id INT REFERENCES suppliers(id),
  item_name VARCHAR(150) NOT NULL,
  supplier_name VARCHAR(150),
  quantity DECIMAL(10,3) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  tax_percent DECIMAL(5,2) DEFAULT 16,
  total DECIMAL(10,2) NOT NULL,
  user_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
