-- VenteApp — Module 6 Clients (alignement BDD v2.0)

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(shop_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_archived ON customers(shop_id, is_archived);
