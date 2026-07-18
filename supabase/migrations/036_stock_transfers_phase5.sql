-- Transferts inter-boutiques — Phase 5
-- Approbation, réception refusée, permission approve

ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_status_check;
ALTER TABLE stock_transfers ADD CONSTRAINT stock_transfers_status_check
  CHECK (status IN (
    'draft',
    'pending_approval',
    'validated',
    'partially_shipped',
    'shipped',
    'partially_received',
    'received',
    'closed',
    'closed_with_exception',
    'cancelled'
  ));

ALTER TABLE stock_transfer_receipt_items
  ADD COLUMN IF NOT EXISTS quantity_refused INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refusal_reason TEXT,
  ADD COLUMN IF NOT EXISTS refusal_resolution TEXT;

INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  (
    'inventory:transfer:approve',
    'inventory',
    'transfer_approve',
    'Approuver transfert',
    'Approuver un transfert soumis (validation FIFO)',
    13
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow'
FROM permissions
WHERE code = 'inventory:transfer:approve'
ON CONFLICT DO NOTHING;
