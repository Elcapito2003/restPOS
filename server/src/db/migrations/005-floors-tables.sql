CREATE TABLE IF NOT EXISTS floors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  floor_id INT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  label VARCHAR(20) NOT NULL,
  capacity INT DEFAULT 4,
  pos_x INT DEFAULT 0,
  pos_y INT DEFAULT 0,
  width INT DEFAULT 80,
  height INT DEFAULT 80,
  shape VARCHAR(10) DEFAULT 'square' CHECK (shape IN ('square', 'round', 'rect')),
  status VARCHAR(20) DEFAULT 'free'
    CHECK (status IN ('free', 'occupied', 'reserved', 'blocked')),
  current_order_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
