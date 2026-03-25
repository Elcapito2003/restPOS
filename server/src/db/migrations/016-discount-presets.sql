CREATE TABLE IF NOT EXISTS discount_presets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE,
  discount_percent DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_preset_id INT REFERENCES discount_presets(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_authorized_by INT REFERENCES users(id);
