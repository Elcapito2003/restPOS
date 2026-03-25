-- Add order_type to distinguish dine-in vs quick/takeout orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in';
-- order_type values: 'dine_in' (comedor), 'quick' (rápido/para llevar)
