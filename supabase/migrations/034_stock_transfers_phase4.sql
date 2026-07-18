-- Transferts inter-boutiques — Phase 4 (clôture, écarts, journal)

ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_status_check;
ALTER TABLE stock_transfers ADD CONSTRAINT stock_transfers_status_check
  CHECK (status IN (
    'draft',
    'validated',
    'partially_shipped',
    'shipped',
    'partially_received',
    'received',
    'closed',
    'closed_with_exception',
    'cancelled'
  ));

ALTER TABLE stock_transfers
  ADD COLUMN IF NOT EXISTS closed_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS closed_at BIGINT;

CREATE TABLE IF NOT EXISTS stock_transfer_events (
  id BIGSERIAL PRIMARY KEY,
  transfer_id BIGINT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  shop_id BIGINT NOT NULL REFERENCES shops(id),
  event_type TEXT NOT NULL,
  actor_user_id BIGINT NOT NULL REFERENCES users(id),
  notes TEXT,
  payload JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_events_transfer
  ON stock_transfer_events(transfer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stock_transfer_discrepancies (
  id BIGSERIAL PRIMARY KEY,
  transfer_id BIGINT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  transfer_item_id BIGINT NOT NULL REFERENCES stock_transfer_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL CHECK (reason IN ('loss', 'breakage', 'theft', 'other')),
  resolution TEXT NOT NULL CHECK (resolution IN ('write_off', 'restock_source')),
  notes TEXT,
  resolved_by BIGINT NOT NULL REFERENCES users(id),
  resolved_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_discrepancies_transfer
  ON stock_transfer_discrepancies(transfer_id);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_discrepancies_item
  ON stock_transfer_discrepancies(transfer_item_id);

ALTER TABLE stock_transfer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfer_events_tenant_all ON stock_transfer_events;
CREATE POLICY stock_transfer_events_tenant_all ON stock_transfer_events
  FOR ALL
  USING (app_allows_stock_transfer(transfer_id))
  WITH CHECK (app_allows_stock_transfer(transfer_id));

ALTER TABLE stock_transfer_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_discrepancies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfer_discrepancies_tenant_all ON stock_transfer_discrepancies;
CREATE POLICY stock_transfer_discrepancies_tenant_all ON stock_transfer_discrepancies
  FOR ALL
  USING (app_allows_stock_transfer(transfer_id))
  WITH CHECK (app_allows_stock_transfer(transfer_id));
