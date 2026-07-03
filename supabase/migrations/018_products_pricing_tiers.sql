-- VenteApp — Grilles tarifaires produits (alignement frontend)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_semi_wholesale INTEGER,
  ADD COLUMN IF NOT EXISTS price_wholesale INTEGER;
