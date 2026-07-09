-- VenteApp — Module Calculateurs Métiers (Activation, Données produits, Historique, RLS & RBAC)

-- ---------------------------------------------------------------------------
-- tenant_modules (activation des modules optionnels par boutique)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_modules (
  id          BIGSERIAL   PRIMARY KEY,
  shop_id     BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  module_code TEXT        NOT NULL,
  enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE(shop_id, module_code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_shop ON tenant_modules(shop_id);

-- ---------------------------------------------------------------------------
-- calculator_product_data (configuration calculateur rattachée à un produit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calculator_product_data (
  id              BIGSERIAL   PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id      BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  calculator_type TEXT        NOT NULL,
  metadata        JSONB       NOT NULL,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE(shop_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_calc_prod_product ON calculator_product_data(product_id);

-- ---------------------------------------------------------------------------
-- calculator_history (historique des calculs enregistrés et favoris)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calculator_history (
  id              BIGSERIAL   PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  calculator_type TEXT        NOT NULL,
  input           JSONB       NOT NULL,
  result          JSONB       NOT NULL,
  is_favorite     BOOLEAN     NOT NULL DEFAULT FALSE,
  label           TEXT,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  created_by      BIGINT      NOT NULL REFERENCES users(id),
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_calc_history_shop ON calculator_history(shop_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tenant_modules', 'calculator_product_data', 'calculator_history']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_tenant ON %I FOR ALL USING (app_allows_shop(shop_id)) WITH CHECK (app_allows_shop(shop_id))',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
INSERT INTO permission_modules (code, label, description, sort_order) VALUES
  ('calculators', 'Calculateurs métiers', 'Calculateurs métiers extensibles et historiques', 60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  ('calculators:use',     'calculators', 'use',     'Utiliser les calculateurs', 'Accéder et effectuer des calculs de chantier', 1),
  ('calculators:export',  'calculators', 'export',  'Exporter les calculs',      'Générer des rapports PDF et partager', 2),
  ('calculators:history', 'calculators', 'history', 'Consulter l''historique',   'Consulter les calculs passés et favoris', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow' FROM permissions WHERE code LIKE 'calculators:%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('seller', 'calculators:use', 'allow'),
  ('seller', 'calculators:export', 'allow'),
  ('seller', 'calculators:history', 'allow'),
  ('viewer', 'calculators:use', 'allow'),
  ('viewer', 'calculators:history', 'allow')
ON CONFLICT DO NOTHING;
