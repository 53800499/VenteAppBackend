-- VenteApp — Journal des mouvements de stock (Module 3 Inventaire)
-- Append-only — UC-03 (initial) / UC-04 (restock, loss, adjustment)

CREATE TABLE IF NOT EXISTS stock_movements (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id          BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id             BIGINT      NOT NULL REFERENCES users(id),
  type                TEXT        NOT NULL
                      CHECK (type IN ('sale', 'restock', 'adjustment', 'loss', 'return', 'initial', 'sale_cancel')),
  quantity_change     INTEGER     NOT NULL,
  quantity_before     INTEGER     NOT NULL CHECK (quantity_before >= 0),
  quantity_after      INTEGER     NOT NULL CHECK (quantity_after >= 0),
  reason              TEXT,
  sale_id             BIGINT      REFERENCES sales(id),
  unit_cost           BIGINT      CHECK (unit_cost IS NULL OR unit_cost > 0),
  created_at          BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product
  ON stock_movements(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_shop
  ON stock_movements(shop_id, created_at DESC);

-- RLS (même modèle que 004)
DO $stock_rls$
BEGIN
  EXECUTE 'ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS stock_movements_tenant_all ON stock_movements';
  EXECUTE $policy$
    CREATE POLICY stock_movements_tenant_all ON stock_movements
    FOR ALL USING (app_allows_shop(shop_id)) WITH CHECK (app_allows_shop(shop_id))
  $policy$;
END $stock_rls$;
