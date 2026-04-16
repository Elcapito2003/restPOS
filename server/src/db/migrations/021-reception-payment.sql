-- Payment tracking for supplier orders
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'partial', 'paid'));
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS received_total DECIMAL(10,2) DEFAULT 0;
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS reception_notes TEXT;

-- Track what was actually received per item (may differ from ordered)
ALTER TABLE supplier_order_items ADD COLUMN IF NOT EXISTS received_quantity DECIMAL(10,3) DEFAULT 0;
ALTER TABLE supplier_order_items ADD COLUMN IF NOT EXISTS received_price DECIMAL(10,2);
