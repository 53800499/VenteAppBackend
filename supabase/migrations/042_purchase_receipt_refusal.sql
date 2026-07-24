-- Refus fournisseur à la réception PO
-- quantity_refused + refusal_reason sur BR ; quantity_refused sur lignes PO

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS quantity_refused INTEGER NOT NULL DEFAULT 0
  CHECK (quantity_refused >= 0);

ALTER TABLE purchase_receipt_items
  ADD COLUMN IF NOT EXISTS quantity_refused INTEGER NOT NULL DEFAULT 0
  CHECK (quantity_refused >= 0);

ALTER TABLE purchase_receipt_items
  ADD COLUMN IF NOT EXISTS refusal_reason TEXT;

COMMENT ON COLUMN purchase_order_items.quantity_refused IS
  'Quantité refusée cumulée (reliquat = ordered − received − refused)';
COMMENT ON COLUMN purchase_receipt_items.quantity_refused IS
  'Quantité refusée sur ce bon (n''entre pas en stock)';
COMMENT ON COLUMN purchase_receipt_items.refusal_reason IS
  'Motif : breakage | humidity | quality | short_delivery | other';
