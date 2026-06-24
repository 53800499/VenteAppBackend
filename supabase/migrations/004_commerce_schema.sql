-- VenteApp — Schéma commerce (tables requises pour le Module 2 Dashboard)
-- Aligné BDD v2.0 — préparation sync multi-boutiques

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE (shop_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_shop ON categories(shop_id);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id         BIGINT      REFERENCES categories(id),
  name                TEXT        NOT NULL,
  sku                 TEXT,
  quantity_in_stock   INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
  alert_threshold     INTEGER     CHECK (alert_threshold IS NULL OR alert_threshold >= 0),
  price_buy           BIGINT      CHECK (price_buy IS NULL OR price_buy > 0),
  price_sell          BIGINT      NOT NULL CHECK (price_sell > 0),
  is_archived         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at          BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version             INTEGER     NOT NULL DEFAULT 1,
  server_id           UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status         TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(shop_id, quantity_in_stock);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  phone           TEXT,
  is_archived     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);

-- ---------------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id     BIGINT      REFERENCES customers(id),
  user_id         BIGINT      NOT NULL REFERENCES users(id),
  reference       TEXT,
  total_amount    BIGINT      NOT NULL CHECK (total_amount >= 0),
  amount_cash     BIGINT      NOT NULL DEFAULT 0 CHECK (amount_cash >= 0),
  amount_momo     BIGINT      NOT NULL DEFAULT 0 CHECK (amount_momo >= 0),
  amount_credit   BIGINT      NOT NULL DEFAULT 0 CHECK (amount_credit >= 0),
  status          TEXT        NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('completed', 'cancelled')),
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  cancelled_at    BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_sales_shop_day ON sales(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_shop_status ON sales(shop_id, status);

-- ---------------------------------------------------------------------------
-- sale_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_items (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id         BIGINT      NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id      BIGINT      REFERENCES products(id),
  product_name    TEXT        NOT NULL,
  quantity        NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price      BIGINT      NOT NULL CHECK (unit_price >= 0),
  unit_cost       BIGINT      CHECK (unit_cost IS NULL OR unit_cost >= 0),
  line_total      BIGINT      NOT NULL CHECK (line_total >= 0),
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_shop ON sale_items(shop_id);

-- ---------------------------------------------------------------------------
-- debts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debts (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id         BIGINT      NOT NULL REFERENCES customers(id),
  sale_id             BIGINT      REFERENCES sales(id),
  original_amount     BIGINT      NOT NULL CHECK (original_amount > 0),
  amount_paid         BIGINT      NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  amount_remaining    BIGINT      NOT NULL CHECK (amount_remaining >= 0),
  status              TEXT        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'closed', 'forgiven')),
  created_at          BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  due_at              BIGINT,
  version             INTEGER     NOT NULL DEFAULT 1,
  server_id           UUID        DEFAULT gen_random_uuid() UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_debts_shop_open ON debts(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_customer ON debts(customer_id);

-- ---------------------------------------------------------------------------
-- RLS commerce (même modèle que 003)
-- ---------------------------------------------------------------------------
DO $commerce_rls$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'categories', 'products', 'customers', 'sales', 'sale_items', 'debts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_all ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_tenant_all ON %I FOR ALL USING (app_allows_shop(shop_id)) WITH CHECK (app_allows_shop(shop_id))',
      tbl, tbl
    );
  END LOOP;
END $commerce_rls$;
