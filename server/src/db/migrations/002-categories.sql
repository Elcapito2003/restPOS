CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INT REFERENCES categories(id),
  color VARCHAR(7) DEFAULT '#6366F1',
  printer_target VARCHAR(10) DEFAULT 'kitchen'
    CHECK (printer_target IN ('kitchen', 'bar', 'both', 'none')),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
