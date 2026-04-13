-- Remove duplicate cancellation reasons, keeping the one with the lowest id
DELETE FROM cancellation_reasons
WHERE id NOT IN (
  SELECT MIN(id) FROM cancellation_reasons GROUP BY name
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE cancellation_reasons ADD CONSTRAINT cancellation_reasons_name_unique UNIQUE (name);

-- Set default printer_target for products that have NULL (created before this column existed)
UPDATE products SET printer_target = 'kitchen' WHERE printer_target IS NULL;
ALTER TABLE products ALTER COLUMN printer_target SET DEFAULT 'kitchen';
