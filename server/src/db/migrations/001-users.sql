CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  pin VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'waiter'
    CHECK (role IN ('admin', 'manager', 'cashier', 'waiter', 'kitchen')),
  avatar_color VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
