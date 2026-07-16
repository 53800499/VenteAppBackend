-- Transferts inter-boutiques — Phase 2 (validation, réservations, multi-expéditions)

ALTER TABLE inventory_lots
  ADD COLUMN IF NOT EXISTS quantity_reserved INTEGER NOT NULL DEFAULT 0
  CHECK (quantity_reserved >= 0);

ALTER TABLE stock_transfers
  ADD COLUMN IF NOT EXISTS validated_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS validated_at BIGINT;

ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_status_check;
ALTER TABLE stock_transfers ADD CONSTRAINT stock_transfers_status_check
  CHECK (status IN (
    'draft',
    'validated',
    'partially_shipped',
    'shipped',
    'partially_received',
    'received',
    'cancelled'
  ));

CREATE TABLE IF NOT EXISTS stock_transfer_shipments (
  id BIGSERIAL PRIMARY KEY,
  transfer_id BIGINT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  notes TEXT,
  shipped_by BIGINT NOT NULL REFERENCES users(id),
  shipped_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_shipments_transfer
  ON stock_transfer_shipments(transfer_id);

CREATE TABLE IF NOT EXISTS stock_transfer_lot_reservations (
  id BIGSERIAL PRIMARY KEY,
  transfer_item_id BIGINT NOT NULL REFERENCES stock_transfer_items(id) ON DELETE CASCADE,
  lot_id BIGINT NOT NULL REFERENCES inventory_lots(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  quantity_shipped INT NOT NULL DEFAULT 0 CHECK (quantity_shipped >= 0),
  unit_cost BIGINT NOT NULL CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_lot_reservations_item
  ON stock_transfer_lot_reservations(transfer_item_id);

ALTER TABLE stock_transfer_lot_lines
  ADD COLUMN IF NOT EXISTS shipment_id BIGINT REFERENCES stock_transfer_shipments(id);

ALTER TABLE stock_transfer_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_shipments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfer_shipments_tenant_all ON stock_transfer_shipments;
CREATE POLICY stock_transfer_shipments_tenant_all ON stock_transfer_shipments
  FOR ALL
  USING (app_allows_stock_transfer(transfer_id))
  WITH CHECK (app_allows_stock_transfer(transfer_id));

ALTER TABLE stock_transfer_lot_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_lot_reservations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfer_lot_reservations_tenant_all ON stock_transfer_lot_reservations;
CREATE POLICY stock_transfer_lot_reservations_tenant_all ON stock_transfer_lot_reservations
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
