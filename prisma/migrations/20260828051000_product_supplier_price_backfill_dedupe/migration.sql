-- Soft-delete every product_supplier_prices row except the most recent one
-- per (product_id, supplier_id), so pre-existing rows created before the
-- dedupe-on-insert rule follow the same "only the latest is current" shape.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY product_id, supplier_id ORDER BY created_at DESC) AS rn
  FROM product_supplier_prices
  WHERE is_deleted = false
)
UPDATE product_supplier_prices
SET is_deleted = true
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
