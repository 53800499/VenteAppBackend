-- ARIKE — Client optionnel sur opérations FX + seuil boutique

ALTER TABLE fx_operations
  ADD COLUMN IF NOT EXISTS customer_id BIGINT NULL REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_fx_operations_customer
  ON fx_operations(shop_id, customer_id)
  WHERE customer_id IS NOT NULL;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS fx_customer_required_above_fcfa BIGINT NOT NULL DEFAULT 0;
