-- Hiérarchie boutique racine → sous-boutiques (RG-SHOP : filiation explicite)

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS parent_shop_id BIGINT REFERENCES shops(id);

CREATE INDEX IF NOT EXISTS idx_shops_parent ON shops(parent_shop_id);

-- Sous-boutiques existantes : rattacher à la boutique par défaut du même patron.
UPDATE shops child
SET parent_shop_id = root.id
FROM shops root
WHERE child.is_default = FALSE
  AND child.parent_shop_id IS NULL
  AND child.owner_user_id IS NOT NULL
  AND root.owner_user_id = child.owner_user_id
  AND root.is_default = TRUE
  AND root.id <> child.id;
