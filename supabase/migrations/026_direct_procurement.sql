-- Approvisionnement direct : bons de réception sans commande fournisseur
-- ---------------------------------------------------------------------------

ALTER TABLE purchase_receipts
  ALTER COLUMN purchase_order_id DROP NOT NULL;

ALTER TABLE purchase_receipts
  ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS receipt_type TEXT NOT NULL DEFAULT 'from_order'
    CHECK (receipt_type IN ('direct', 'from_order'));

UPDATE purchase_receipts pr
SET supplier_id = po.supplier_id
FROM purchase_orders po
WHERE pr.purchase_order_id = po.id
  AND pr.supplier_id IS NULL;

ALTER TABLE purchase_receipts
  ALTER COLUMN supplier_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_supplier
  ON purchase_receipts(supplier_id);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_type
  ON purchase_receipts(receipt_type);

ALTER TABLE purchase_receipt_items
  ALTER COLUMN purchase_order_item_id DROP NOT NULL;
