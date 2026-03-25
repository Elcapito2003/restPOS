CREATE TABLE IF NOT EXISTS modifier_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  min_select INT DEFAULT 0,
  max_select INT DEFAULT 1,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modifiers (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price_extra DECIMAL(10,2) DEFAULT 0.00,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS product_modifier_groups (
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_id INT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, group_id)
);
