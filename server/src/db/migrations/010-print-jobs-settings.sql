CREATE TABLE IF NOT EXISTS print_jobs (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('comanda', 'receipt', 'report', 'test')),
  printer_target VARCHAR(20) NOT NULL,
  order_id INT REFERENCES orders(id),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'printed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('restaurant_name', 'Mi Restaurante'),
  ('restaurant_address', ''),
  ('restaurant_phone', ''),
  ('restaurant_rfc', ''),
  ('default_tax_rate', '0.16'),
  ('currency_symbol', '$'),
  ('printer_kitchen_ip', ''),
  ('printer_bar_ip', ''),
  ('printer_cashier_ip', '')
ON CONFLICT (key) DO NOTHING;
