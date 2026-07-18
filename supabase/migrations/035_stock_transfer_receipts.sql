-- Transferts inter-boutiques — Phase 5 (réceptions explicites)

CREATE TABLE IF NOT EXISTS stock_transfer_receipts (
  id BIGSERIAL PRIMARY KEY,
  transfer_id BIGINT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  shipment_id BIGINT REFERENCES stock_transfer_shipments(id) ON DELETE SET NULL,
  reference TEXT NOT NULL,
  notes TEXT,
  received_by BIGINT NOT NULL REFERENCES users(id),
  received_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_receipts_transfer
  ON stock_transfer_receipts(transfer_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_receipts_shipment
  ON stock_transfer_receipts(shipment_id);

CREATE TABLE IF NOT EXISTS stock_transfer_receipt_items (
  id BIGSERIAL PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES stock_transfer_receipts(id) ON DELETE CASCADE,
  transfer_item_id BIGINT NOT NULL REFERENCES stock_transfer_items(id) ON DELETE CASCADE,
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_receipt_items_receipt
  ON stock_transfer_receipt_items(receipt_id);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_receipt_items_item
  ON stock_transfer_receipt_items(transfer_item_id);

ALTER TABLE stock_transfer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfer_receipts_tenant_all ON stock_transfer_receipts;
CREATE POLICY stock_transfer_receipts_tenant_all ON stock_transfer_receipts
  FOR ALL
  USING (app_allows_stock_transfer(transfer_id))
  WITH CHECK (app_allows_stock_transfer(transfer_id));

ALTER TABLE stock_transfer_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_receipt_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfer_receipt_items_tenant_all ON stock_transfer_receipt_items;
CREATE POLICY stock_transfer_receipt_items_tenant_all ON stock_transfer_receipt_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM stock_transfer_receipts r
      WHERE r.id = receipt_id
        AND app_allows_stock_transfer(r.transfer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM stock_transfer_receipts r
      WHERE r.id = receipt_id
        AND app_allows_stock_transfer(r.transfer_id)
    )
  );
