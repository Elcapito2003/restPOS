-- Milk modifier group for drinks in subgrupos 10 oz / 12 oz / 16 oz
DO $$
DECLARE
  g_id INT;
BEGIN
  -- Create group only if it doesn't already exist
  SELECT id INTO g_id FROM modifier_groups WHERE name = 'Leche' LIMIT 1;

  IF g_id IS NULL THEN
    INSERT INTO modifier_groups (name, min_select, max_select, is_required)
    VALUES ('Leche', 1, 1, true)
    RETURNING id INTO g_id;

    INSERT INTO modifiers (group_id, name, price_extra, sort_order) VALUES
      (g_id, 'Entera',        0.00, 1),
      (g_id, 'Deslactosada',  0.00, 2),
      (g_id, 'Avena',        20.00, 3),
      (g_id, 'Almendra',     20.00, 4);
  END IF;

  -- Attach to every product whose category is a subgrupo named 10 oz / 12 oz / 16 oz
  INSERT INTO product_modifier_groups (product_id, group_id, is_forced)
  SELECT p.id, g_id, true
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE c.parent_id IS NOT NULL
    AND (
      c.name ILIKE '%10 oz%' OR c.name ILIKE '%10oz%' OR
      c.name ILIKE '%12 oz%' OR c.name ILIKE '%12oz%' OR
      c.name ILIKE '%16 oz%' OR c.name ILIKE '%16oz%'
    )
  ON CONFLICT (product_id, group_id) DO NOTHING;
END $$;
