-- Hiérarchie boutique : sous-boutiques rattachées à la boutique principale (RG-SHOP-09)

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS parent_shop_id BIGINT REFERENCES shops(id);

CREATE INDEX IF NOT EXISTS idx_shops_parent ON shops(parent_shop_id);

-- Rattacher les boutiques existantes sans parent à la boutique par défaut du patron.
UPDATE shops child
SET parent_shop_id = parent.id
FROM shops parent
WHERE child.parent_shop_id IS NULL
  AND NOT child.is_default
  AND child.owner_user_id IS NOT NULL
  AND parent.owner_user_id = child.owner_user_id
  AND parent.is_default = TRUE
  AND parent.id <> child.id;
