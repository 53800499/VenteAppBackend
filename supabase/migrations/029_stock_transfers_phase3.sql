-- Transferts inter-boutiques — Phase 3 (retour dédié)

ALTER TABLE stock_transfers
  ADD COLUMN IF NOT EXISTS transfer_type TEXT NOT NULL DEFAULT 'outbound'
    CHECK (transfer_type IN ('outbound', 'return')),
  ADD COLUMN IF NOT EXISTS parent_transfer_id BIGINT
    REFERENCES stock_transfers(id);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_parent
  ON stock_transfers(parent_transfer_id)
  WHERE parent_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_transfers_transfer_type
  ON stock_transfers(transfer_type);
