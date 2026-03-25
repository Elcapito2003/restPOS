CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  method VARCHAR(20) NOT NULL
    CHECK (method IN ('cash', 'visa', 'mastercard', 'amex', 'other_card', 'transfer', 'other')),
  amount DECIMAL(10,2) NOT NULL,
  tip DECIMAL(10,2) DEFAULT 0.00,
  reference VARCHAR(100),
  received_amount DECIMAL(10,2),
  change_amount DECIMAL(10,2) DEFAULT 0.00,
  cashier_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
