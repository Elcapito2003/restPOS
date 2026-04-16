-- MercadoLibre purchase requests (from chatbot/employees)
CREATE TABLE IF NOT EXISTS ml_requests (
  id SERIAL PRIMARY KEY,
  product_description TEXT NOT NULL,
  quantity INT DEFAULT 1,
  max_price DECIMAL(10,2),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'searching', 'purchased', 'cancelled')),
  requested_by VARCHAR(100),
  notes TEXT,
  search_query TEXT,
  purchased_title TEXT,
  purchased_url TEXT,
  purchased_price DECIMAL(10,2),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
