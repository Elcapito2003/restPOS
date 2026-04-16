-- Presentaciones de insumos (marca + contenido predefinido por admin)
CREATE TABLE IF NOT EXISTS inventory_presentations (
  id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  brand VARCHAR(100),
  description VARCHAR(150),
  content_quantity DECIMAL(10,3) NOT NULL,
  content_unit VARCHAR(50) NOT NULL,
  sku VARCHAR(50),
  reference_price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_presentations_item ON inventory_presentations(item_id);
