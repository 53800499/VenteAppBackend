-- Transferts inter-boutiques (stock FIFO préservé)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_transfers (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL,
  source_shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  destination_shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'shipped', 'partially_received', 'received', 'cancelled')),
  notes TEXT,
  created_by BIGINT NOT NULL REFERENCES users(id),
  shipped_by BIGINT REFERENCES users(id),
  received_by BIGINT REFERENCES users(id),
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  shipped_at BIGINT,
  received_at BIGINT,
  version INTEGER NOT NULL DEFAULT 1,
  server_id UUID DEFAULT gen_random_uuid() UNIQUE,
  sync_status TEXT CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  CONSTRAINT stock_transfers_shops_distinct CHECK (source_shop_id <> destination_shop_id),
  CONSTRAINT stock_transfers_reference_unique UNIQUE (source_shop_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_source
  ON stock_transfers(source_shop_id);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_destination
  ON stock_transfers(destination_shop_id);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_status
  ON stock_transfers(status);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id BIGSERIAL PRIMARY KEY,
  transfer_id BIGINT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  source_product_id BIGINT NOT NULL REFERENCES products(id),
  destination_product_id BIGINT REFERENCES products(id),
  product_server_id UUID,
  quantity_requested INT NOT NULL CHECK (quantity_requested > 0),
  quantity_shipped INT NOT NULL DEFAULT 0 CHECK (quantity_shipped >= 0),
  quantity_received INT NOT NULL DEFAULT 0 CHECK (quantity_received >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer
  ON stock_transfer_items(transfer_id);

CREATE TABLE IF NOT EXISTS stock_transfer_lot_lines (
  id BIGSERIAL PRIMARY KEY,
  transfer_item_id BIGINT NOT NULL REFERENCES stock_transfer_items(id) ON DELETE CASCADE,
  source_lot_id BIGINT NOT NULL REFERENCES inventory_lots(id),
  destination_lot_id BIGINT REFERENCES inventory_lots(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  quantity_received INT NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost BIGINT NOT NULL CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_lot_lines_item
  ON stock_transfer_lot_lines(transfer_item_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (dual-boutique : source OU destination)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_allows_stock_transfer(p_transfer_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM stock_transfers t
    WHERE t.id = p_transfer_id
      AND (
        app_allows_shop(t.source_shop_id)
        OR app_allows_shop(t.destination_shop_id)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION app_allows_stock_transfer(BIGINT)
  TO service_role, authenticated, anon;

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfers_tenant_all ON stock_transfers;
CREATE POLICY stock_transfers_tenant_all ON stock_transfers
  FOR ALL
  USING (
    app_allows_shop(source_shop_id)
    OR app_allows_shop(destination_shop_id)
  )
  WITH CHECK (
    app_allows_shop(source_shop_id)
    OR app_allows_shop(destination_shop_id)
  );

ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfer_items_tenant_all ON stock_transfer_items;
CREATE POLICY stock_transfer_items_tenant_all ON stock_transfer_items
  FOR ALL
  USING (app_allows_stock_transfer(transfer_id))
  WITH CHECK (app_allows_stock_transfer(transfer_id));

ALTER TABLE stock_transfer_lot_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_lot_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfer_lot_lines_tenant_all ON stock_transfer_lot_lines;
CREATE POLICY stock_transfer_lot_lines_tenant_all ON stock_transfer_lot_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM stock_transfer_items i
      WHERE i.id = transfer_item_id
        AND app_allows_stock_transfer(i.transfer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM stock_transfer_items i
      WHERE i.id = transfer_item_id
        AND app_allows_stock_transfer(i.transfer_id)
    )
  );

-- ---------------------------------------------------------------------------
-- RBAC — permissions transferts inter-boutiques
-- ---------------------------------------------------------------------------
INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  ('inventory:transfer:read',    'inventory', 'transfer_read',    'Consulter transferts',     'Voir les transferts inter-boutiques',                    10),
  ('inventory:transfer:create',  'inventory', 'transfer_create',  'Créer / expédier transfert','Créer et expédier un transfert de stock',              11),
  ('inventory:transfer:receive', 'inventory', 'transfer_receive', 'Réceptionner transfert',   'Réceptionner un transfert entrant dans la boutique',     12)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow'
FROM permissions
WHERE code LIKE 'inventory:transfer:%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('seller', 'inventory:transfer:read',    'allow'),
  ('seller', 'inventory:transfer:create',  'allow'),
  ('seller', 'inventory:transfer:receive', 'allow')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('viewer', 'inventory:transfer:read', 'allow')
ON CONFLICT DO NOTHING;
