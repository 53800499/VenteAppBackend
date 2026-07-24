-- Commandes clients (Sales Orders) + métadonnées livraison (chauffeur / plaque)
-- Les tables n'existaient pas encore côté remote (module livré offline Drift d'abord).

-- ---------------------------------------------------------------------------
-- sales_orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_orders (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id     BIGINT      NOT NULL REFERENCES customers(id),
  number          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN (
                    'draft', 'confirmed', 'preparing',
                    'partially_delivered', 'delivered', 'cancelled', 'closed'
                  )),
  ordered_at      BIGINT      NOT NULL,
  subtotal        BIGINT      NOT NULL CHECK (subtotal >= 0),
  discount        BIGINT      NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax             BIGINT      NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total           BIGINT      NOT NULL CHECK (total >= 0),
  notes           TEXT,
  created_by      BIGINT      NOT NULL REFERENCES users(id),
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  synced_at       BIGINT,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE (shop_id, number)
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_shop_status
  ON sales_orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer
  ON sales_orders(customer_id);

-- ---------------------------------------------------------------------------
-- sales_order_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_order_items (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sales_order_id      BIGINT      NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id          BIGINT      NOT NULL REFERENCES products(id),
  quantity_ordered    INTEGER     NOT NULL CHECK (quantity_ordered > 0),
  quantity_delivered  INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_delivered >= 0),
  quantity_refused    INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_refused >= 0),
  unit_price          BIGINT      NOT NULL CHECK (unit_price >= 0),
  line_total          BIGINT      NOT NULL CHECK (line_total >= 0),
  version             INTEGER     NOT NULL DEFAULT 1,
  server_id           UUID        DEFAULT gen_random_uuid() UNIQUE,
  synced_at           BIGINT,
  sync_status         TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_sales_order_items_order
  ON sales_order_items(sales_order_id);

-- ---------------------------------------------------------------------------
-- sales_order_deliveries (+ meta chauffeur / plaque)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_order_deliveries (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sales_order_id  BIGINT      NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  number          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'completed',
  delivered_at    BIGINT      NOT NULL,
  delivered_by    BIGINT      NOT NULL REFERENCES users(id),
  sale_id         BIGINT      REFERENCES sales(id),
  notes           TEXT,
  driver_name     TEXT,
  vehicle_plate   TEXT,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  synced_at       BIGINT,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE (shop_id, number)
);

CREATE INDEX IF NOT EXISTS idx_sales_order_deliveries_order
  ON sales_order_deliveries(sales_order_id);

-- Si la table existait déjà sans meta (cas rare) :
ALTER TABLE sales_order_deliveries
  ADD COLUMN IF NOT EXISTS driver_name TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;

-- ---------------------------------------------------------------------------
-- sales_order_delivery_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_order_delivery_items (
  id                    BIGSERIAL PRIMARY KEY,
  shop_id               BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  delivery_id           BIGINT      NOT NULL REFERENCES sales_order_deliveries(id) ON DELETE CASCADE,
  sales_order_item_id   BIGINT      NOT NULL REFERENCES sales_order_items(id),
  product_id            BIGINT      NOT NULL REFERENCES products(id),
  quantity_sent         INTEGER     NOT NULL CHECK (quantity_sent >= 0),
  quantity_accepted     INTEGER     NOT NULL CHECK (quantity_accepted >= 0),
  quantity_refused      INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_refused >= 0),
  refusal_reason        TEXT,
  unit_price            BIGINT      NOT NULL CHECK (unit_price >= 0),
  version               INTEGER     NOT NULL DEFAULT 1,
  server_id             UUID        DEFAULT gen_random_uuid() UNIQUE,
  synced_at             BIGINT,
  sync_status           TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_sales_order_delivery_items_delivery
  ON sales_order_delivery_items(delivery_id);

-- ---------------------------------------------------------------------------
-- sales_order_history_entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_order_history_entries (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sales_order_id  BIGINT      NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL,
  performed_by    BIGINT      NOT NULL REFERENCES users(id),
  performed_at    BIGINT      NOT NULL,
  details         TEXT
);

CREATE INDEX IF NOT EXISTS idx_sales_order_history_order
  ON sales_order_history_entries(sales_order_id);

COMMENT ON TABLE sales_orders IS
  'Commandes clients différées avec livraisons partielles';
COMMENT ON COLUMN sales_order_deliveries.driver_name IS
  'Chauffeur (optionnel)';
COMMENT ON COLUMN sales_order_deliveries.vehicle_plate IS
  'Plaque véhicule (optionnel)';
