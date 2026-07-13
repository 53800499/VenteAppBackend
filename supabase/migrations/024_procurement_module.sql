-- VenteApp — Module Approvisionnements / Commandes Fournisseur
-- RLS, Offline-first (version, server_id, sync_status)

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE (shop_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_shop ON suppliers(shop_id);

-- ---------------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_id     BIGINT      NOT NULL REFERENCES suppliers(id),
  number          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'validated', 'sent', 'partially_received', 'received', 'cancelled')),
  ordered_at      BIGINT      NOT NULL,
  expected_at     BIGINT,
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
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE (shop_id, number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_shop_status ON purchase_orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);

-- ---------------------------------------------------------------------------
-- purchase_order_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  purchase_order_id   BIGINT      NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          BIGINT      NOT NULL REFERENCES products(id),
  quantity_ordered    INTEGER     NOT NULL CHECK (quantity_ordered > 0),
  quantity_received   INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost           BIGINT      NOT NULL CHECK (unit_cost >= 0),
  discount            BIGINT      NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax                 BIGINT      NOT NULL DEFAULT 0 CHECK (tax >= 0),
  subtotal            BIGINT      NOT NULL CHECK (subtotal >= 0),
  version             INTEGER     NOT NULL DEFAULT 1,
  server_id           UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status         TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);

-- ---------------------------------------------------------------------------
-- purchase_receipts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_receipts (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  purchase_order_id   BIGINT      NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  receipt_number      TEXT        NOT NULL,
  received_at         BIGINT      NOT NULL,
  received_by         BIGINT      NOT NULL REFERENCES users(id),
  notes               TEXT,
  version             INTEGER     NOT NULL DEFAULT 1,
  server_id           UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status         TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE (shop_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_po ON purchase_receipts(purchase_order_id);

-- ---------------------------------------------------------------------------
-- purchase_receipt_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_receipt_items (
  id                      BIGSERIAL PRIMARY KEY,
  shop_id                 BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  purchase_receipt_id     BIGINT      NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id  BIGINT      NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  product_id              BIGINT      NOT NULL REFERENCES products(id),
  quantity_received       INTEGER     NOT NULL CHECK (quantity_received > 0),
  unit_cost               BIGINT      NOT NULL CHECK (unit_cost >= 0),
  batch_number            TEXT,
  expiry_date             BIGINT,
  version                 INTEGER     NOT NULL DEFAULT 1,
  server_id               UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status             TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt ON purchase_receipt_items(purchase_receipt_id);

-- ---------------------------------------------------------------------------
-- supplier_invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  purchase_order_id   BIGINT      REFERENCES purchase_orders(id) ON DELETE SET NULL,
  invoice_number      TEXT        NOT NULL,
  supplier_id         BIGINT      NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invoice_date        BIGINT      NOT NULL,
  due_date            BIGINT,
  subtotal            BIGINT      NOT NULL CHECK (subtotal >= 0),
  tax                 BIGINT      NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total               BIGINT      NOT NULL CHECK (total >= 0),
  status              TEXT        NOT NULL DEFAULT 'unpaid'
                      CHECK (status IN ('unpaid', 'partially_paid', 'paid')),
  created_at          BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at          BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version             INTEGER     NOT NULL DEFAULT 1,
  server_id           UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status         TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE (shop_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po ON supplier_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);

-- ---------------------------------------------------------------------------
-- supplier_payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_payments (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_id          BIGINT      NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  amount              BIGINT      NOT NULL CHECK (amount > 0),
  payment_method      TEXT        NOT NULL DEFAULT 'cash'
                      CHECK (payment_method IN ('cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check')),
  payment_date        BIGINT      NOT NULL,
  reference           TEXT,
  created_at          BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version             INTEGER     NOT NULL DEFAULT 1,
  server_id           UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status         TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice ON supplier_payments(invoice_id);

-- ---------------------------------------------------------------------------
-- purchase_order_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order_history (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  purchase_order_id   BIGINT      NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  action              TEXT        NOT NULL,
  performed_by        BIGINT      NOT NULL REFERENCES users(id),
  performed_at        BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  details             TEXT
);

CREATE INDEX IF NOT EXISTS idx_po_history_po ON purchase_order_history(purchase_order_id, performed_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'suppliers', 'purchase_orders', 'purchase_order_items',
    'purchase_receipts', 'purchase_receipt_items',
    'supplier_invoices', 'supplier_payments', 'purchase_order_history'
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
END $$;

-- ---------------------------------------------------------------------------
-- RBAC Permissions Registration
-- ---------------------------------------------------------------------------
INSERT INTO permission_modules (code, label, description, sort_order) VALUES
  ('procurement', 'Approvisionnements', 'Gestion des commandes fournisseur et réceptions', 60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  ('procurement:read',        'procurement', 'read',        'Consulter commandes',     'Voir les commandes d''approvisionnement et factures',  1),
  ('procurement:create',      'procurement', 'create',      'Créer commande',          'Créer une nouvelle commande fournisseur',             2),
  ('procurement:update',      'procurement', 'update',      'Modifier commande',       'Modifier une commande fournisseur (brouillon)',       3),
  ('procurement:receive',     'procurement', 'receive',     'Réceptionner livraison',  'Enregistrer la réception de marchandises',            4),
  ('procurement:invoice_pay', 'procurement', 'invoice_pay', 'Gérer factures/paiements','Enregistrer factures et paiements fournisseur',      5),
  ('procurement:cancel',      'procurement', 'cancel',      'Annuler commande',        'Annuler ou rejeter une commande fournisseur',         6)
ON CONFLICT (code) DO NOTHING;

-- Grant all procurement permissions to Owner role
INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow' FROM permissions WHERE code LIKE 'procurement:%'
ON CONFLICT DO NOTHING;

-- Grant read & receive permissions to Seller (vendeur) role
INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('seller', 'procurement:read', 'allow'),
  ('seller', 'procurement:receive', 'allow')
ON CONFLICT DO NOTHING;

-- Grant read permission to Viewer (lecteur) role
INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('viewer', 'procurement:read', 'allow')
ON CONFLICT DO NOTHING;
