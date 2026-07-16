-- VenteApp — Lots de stock (FIFO) + allocations vente

CREATE TABLE IF NOT EXISTS inventory_lots (
  id                      BIGSERIAL PRIMARY KEY,
  shop_id                 BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id              BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_type             TEXT        NOT NULL,
  source_id               BIGINT,
  purchase_receipt_item_id BIGINT     REFERENCES purchase_receipt_items(id),
  supplier_id             BIGINT      REFERENCES suppliers(id),
  unit_cost               BIGINT      NOT NULL CHECK (unit_cost >= 0),
  quantity_received       INTEGER     NOT NULL CHECK (quantity_received > 0),
  quantity_remaining      INTEGER     NOT NULL CHECK (quantity_remaining >= 0),
  batch_number            TEXT,
  expiry_date             BIGINT,
  received_at             BIGINT      NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'depleted')),
  created_at              BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version                 INTEGER     NOT NULL DEFAULT 1,
  server_id               TEXT,
  sync_status             TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_product_fifo
  ON inventory_lots(shop_id, product_id, received_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_receipt_item
  ON inventory_lots(purchase_receipt_item_id)
  WHERE purchase_receipt_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sale_item_lot_allocations (
  id                BIGSERIAL PRIMARY KEY,
  shop_id           BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_item_id      BIGINT      NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  inventory_lot_id  BIGINT      NOT NULL REFERENCES inventory_lots(id),
  quantity          INTEGER     NOT NULL CHECK (quantity > 0),
  unit_cost         BIGINT      NOT NULL CHECK (unit_cost >= 0),
  created_at        BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_sale_item_lot_alloc_sale_item
  ON sale_item_lot_allocations(sale_item_id);

-- Backfill : un lot initial par produit ayant du stock
INSERT INTO inventory_lots (
  shop_id, product_id, source_type, unit_cost,
  quantity_received, quantity_remaining, received_at, status, created_at
)
SELECT
  p.shop_id,
  p.id,
  'initial_migration',
  COALESCE(p.price_buy, 0),
  p.quantity_in_stock,
  p.quantity_in_stock,
  COALESCE(p.updated_at, p.created_at),
  'active',
  COALESCE(p.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
FROM products p
WHERE p.quantity_in_stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM inventory_lots l
    WHERE l.shop_id = p.shop_id
      AND l.product_id = p.id
      AND l.source_type = 'initial_migration'
  );

DO $lots_rls$
BEGIN
  EXECUTE 'ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE inventory_lots FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS inventory_lots_tenant_all ON inventory_lots';
  EXECUTE $policy$
    CREATE POLICY inventory_lots_tenant_all ON inventory_lots
    FOR ALL USING (app_allows_shop(shop_id)) WITH CHECK (app_allows_shop(shop_id))
  $policy$;

  EXECUTE 'ALTER TABLE sale_item_lot_allocations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE sale_item_lot_allocations FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS sale_item_lot_alloc_tenant_all ON sale_item_lot_allocations';
  EXECUTE $policy$
    CREATE POLICY sale_item_lot_alloc_tenant_all ON sale_item_lot_allocations
    FOR ALL USING (app_allows_shop(shop_id)) WITH CHECK (app_allows_shop(shop_id))
  $policy$;
END $lots_rls$;
