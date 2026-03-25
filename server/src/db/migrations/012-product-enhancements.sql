-- Product enhancements: composite products & modifier group forced capture
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_composite BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE product_modifier_groups ADD COLUMN IF NOT EXISTS is_forced BOOLEAN DEFAULT false;
ALTER TABLE product_modifier_groups ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
