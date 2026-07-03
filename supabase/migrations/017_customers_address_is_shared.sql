-- VenteApp — Clients : adresse et partage multi-boutiques (alignement frontend)

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_customers_shared
  ON customers (shop_id, is_shared)
  WHERE is_shared = TRUE;
