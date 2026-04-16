-- Órdenes de compra a proveedores
CREATE TABLE IF NOT EXISTS supplier_orders (
  id SERIAL PRIMARY KEY,
  supplier_id INT REFERENCES suppliers(id),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','received','cancelled')),
  notes TEXT,
  estimated_total DECIMAL(10,2) DEFAULT 0,
  confirmed_total DECIMAL(10,2),
  created_by INT REFERENCES users(id),
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items del pedido
CREATE TABLE IF NOT EXISTS supplier_order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES supplier_orders(id) ON DELETE CASCADE,
  item_id INT REFERENCES inventory_items(id),
  item_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit VARCHAR(50),
  estimated_price DECIMAL(10,2) DEFAULT 0,
  confirmed_price DECIMAL(10,2)
);

-- Mensajes de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES supplier_orders(id) ON DELETE SET NULL,
  supplier_id INT REFERENCES suppliers(id),
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('out','in')),
  message TEXT NOT NULL,
  phone VARCHAR(30),
  wa_message_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
