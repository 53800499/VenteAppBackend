-- Métadonnées expédition transfert : référence SHP, chauffeur, plaque

ALTER TABLE stock_transfer_shipments
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS driver_name TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;

UPDATE stock_transfer_shipments s
SET reference = 'SHP-' || s.transfer_id || '-' || sub.seq
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY transfer_id
      ORDER BY shipped_at ASC, id ASC
    ) AS seq
  FROM stock_transfer_shipments
  WHERE reference IS NULL
) sub
WHERE s.id = sub.id;

ALTER TABLE stock_transfer_shipments
  ALTER COLUMN reference SET DEFAULT '';

UPDATE stock_transfer_shipments
SET reference = 'SHP-' || transfer_id || '-1'
WHERE reference IS NULL OR reference = '';

ALTER TABLE stock_transfer_shipments
  ALTER COLUMN reference SET NOT NULL;
