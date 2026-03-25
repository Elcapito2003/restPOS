CREATE TABLE IF NOT EXISTS cash_registers (
  id SERIAL PRIMARY KEY,
  opened_by INT NOT NULL REFERENCES users(id),
  closed_by INT REFERENCES users(id),
  opening_amount DECIMAL(10,2) NOT NULL,
  expected_amount DECIMAL(10,2),
  actual_amount DECIMAL(10,2),
  difference DECIMAL(10,2),
  status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id SERIAL PRIMARY KEY,
  register_id INT NOT NULL REFERENCES cash_registers(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out')),
  amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(200) NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
