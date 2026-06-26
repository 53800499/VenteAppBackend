-- VenteApp — Module 4 Ventes (alignement BDD v2.0)

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS sale_type TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS subtotal BIGINT,
  ADD COLUMN IF NOT EXISTS discount_amount BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS amount_paid BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at BIGINT,
  ADD COLUMN IF NOT EXISTS note TEXT;

UPDATE sales
SET
  receipt_number = COALESCE(reference, 'REC-LEGACY-' || id::text),
  subtotal = COALESCE(subtotal, total_amount),
  amount_paid = CASE
    WHEN amount_paid > 0 THEN amount_paid
    ELSE GREATEST(total_amount - amount_credit, amount_cash + amount_momo)
  END,
  updated_at = COALESCE(updated_at, created_at)
WHERE receipt_number IS NULL OR subtotal IS NULL OR updated_at IS NULL;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_sale_type_check
  CHECK (sale_type IN ('standard', 'quick'));

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'mtn_momo', 'moov_money', 'credit', 'mixed'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_shop_receipt
  ON sales (shop_id, receipt_number);

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS discount_amount BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_items_sale_product
  ON sale_items (sale_id, product_id)
  WHERE product_id IS NOT NULL;
