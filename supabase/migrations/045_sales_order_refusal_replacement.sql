-- Destination du refus + remplacement inline à la livraison (commandes clients)

ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS quantity_replaced INTEGER NOT NULL DEFAULT 0
    CHECK (quantity_replaced >= 0);

ALTER TABLE sales_order_delivery_items
  ADD COLUMN IF NOT EXISTS refusal_destination TEXT
    CHECK (
      refusal_destination IS NULL
      OR refusal_destination IN ('return_to_stock', 'loss')
    ),
  ADD COLUMN IF NOT EXISTS quantity_replaced INTEGER NOT NULL DEFAULT 0
    CHECK (quantity_replaced >= 0),
  ADD COLUMN IF NOT EXISTS replacement_product_id BIGINT
    REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS replacement_unit_price BIGINT
    CHECK (replacement_unit_price IS NULL OR replacement_unit_price >= 0);

COMMENT ON COLUMN sales_order_delivery_items.refusal_destination IS
  'return_to_stock = stock inchangé ; loss = perte inventaire (gérée offline)';
COMMENT ON COLUMN sales_order_delivery_items.quantity_replaced IS
  'Quantité remplacée par un autre produit à la livraison';
COMMENT ON COLUMN sales_order_delivery_items.replacement_product_id IS
  'Produit de remplacement (si quantity_replaced > 0)';
