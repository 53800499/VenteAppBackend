-- Raison du reliquat après une livraison partielle (commandes clients)

ALTER TABLE sales_order_deliveries
  ADD COLUMN IF NOT EXISTS remaining_reason TEXT
    CHECK (
      remaining_reason IS NULL
      OR remaining_reason IN (
        'truck_full',
        'postponed',
        'stock_short',
        'client_request',
        'other'
      )
    );

COMMENT ON COLUMN sales_order_deliveries.remaining_reason IS
  'Pourquoi un reliquat reste après cette livraison (null si commande soldée)';
