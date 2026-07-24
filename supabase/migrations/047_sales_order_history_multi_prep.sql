-- Fondation SO : history payload + prep multi-appareil

ALTER TABLE sales_order_history_entries
  ADD COLUMN IF NOT EXISTS payload TEXT;

COMMENT ON COLUMN sales_order_history_entries.payload IS
  'JSON optionnel (qty, remainingReason, deliveryNumber, …)';

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS device_id TEXT;

COMMENT ON COLUMN sales_orders.updated_by IS
  'Dernier utilisateur ayant modifié la commande';
COMMENT ON COLUMN sales_orders.device_id IS
  'Appareil ayant effectué le dernier write (prep multi-appareil)';
