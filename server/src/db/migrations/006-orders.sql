CREATE TABLE IF NOT EXISTS daily_counters (
  id SERIAL PRIMARY KEY,
  counter_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  last_number INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  daily_number INT,
  table_id INT REFERENCES tables(id),
  waiter_id INT NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open', 'sent', 'partial', 'closed', 'cancelled')),
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  tax DECIMAL(10,2) DEFAULT 0.00,
  discount_percent DECIMAL(5,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  tip DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  guest_count INT DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE tables ADD CONSTRAINT fk_tables_current_order
  FOREIGN KEY (current_order_id) REFERENCES orders(id);
