-- Shifts (Turnos)
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  register_id INT REFERENCES cash_registers(id),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(100),
  address TEXT,
  tax_id VARCHAR(20),
  client_type VARCHAR(30) DEFAULT 'general',
  credit_limit DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense types (Tipos de gastos)
CREATE TABLE IF NOT EXISTS expense_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INT REFERENCES expense_types(id),
  is_active BOOLEAN DEFAULT true
);

-- Expenses (Gastos)
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  expense_type_id INT NOT NULL REFERENCES expense_types(id),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  user_id INT NOT NULL REFERENCES users(id),
  register_id INT REFERENCES cash_registers(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cancellation reasons (Motivos de cancelación)
CREATE TABLE IF NOT EXISTS cancellation_reasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Add columns to orders for enhanced features
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id INT REFERENCES shifts(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) DEFAULT 'comedor' CHECK (service_type IN ('comedor', 'rapido', 'domicilio'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) DEFAULT 'percent' CHECK (discount_type IN ('percent', 'amount'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by INT REFERENCES users(id);

-- Add cancel_reason to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled_by INT REFERENCES users(id);

-- Insert default cancellation reasons
INSERT INTO cancellation_reasons (name) VALUES
  ('Cliente no quiso'),
  ('Error de captura'),
  ('Producto agotado'),
  ('Demora excesiva'),
  ('Platillo incorrecto'),
  ('Cortesía de la casa'),
  ('Otro motivo')
ON CONFLICT DO NOTHING;

-- Insert default expense types
INSERT INTO expense_types (name) VALUES
  ('Gastos operativos'),
  ('Compras de insumos'),
  ('Servicios'),
  ('Nómina'),
  ('Mantenimiento'),
  ('Otros')
ON CONFLICT DO NOTHING;
