-- VenteApp — Module Dépenses (bénéfice réel, caisse, offline-first)

-- ---------------------------------------------------------------------------
-- expense_categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  color           TEXT,
  icon            TEXT,
  is_system       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE (shop_id, name)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_shop ON expense_categories(shop_id);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id     BIGINT      REFERENCES expense_categories(id),
  title           TEXT        NOT NULL,
  description     TEXT,
  amount          BIGINT      NOT NULL CHECK (amount > 0),
  expense_date    BIGINT      NOT NULL,
  payment_method  TEXT        NOT NULL DEFAULT 'cash'
                  CHECK (payment_method IN ('cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check')),
  created_by      BIGINT      NOT NULL REFERENCES users(id),
  supplier        TEXT,
  invoice_number  TEXT,
  repeat_schedule TEXT        NOT NULL DEFAULT 'none'
                  CHECK (repeat_schedule IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  status          TEXT        NOT NULL DEFAULT 'validated'
                  CHECK (status IN ('draft', 'pending', 'validated', 'refused')),
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  deleted_at      BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_shop_date ON expenses(shop_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_status ON expenses(shop_id, status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- expense_attachments (métadonnées — fichiers locaux côté app V1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_attachments (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  expense_id      BIGINT      NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  file_name       TEXT        NOT NULL,
  mime_type       TEXT,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense ON expense_attachments(expense_id);

-- ---------------------------------------------------------------------------
-- expense_history (audit des modifications)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_history (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  expense_id      BIGINT      NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id         BIGINT      NOT NULL REFERENCES users(id),
  field_name      TEXT        NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_expense_history_expense ON expense_history(expense_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- category_budgets (budget mensuel par catégorie)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category_budgets (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id     BIGINT      NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  monthly_amount  BIGINT      NOT NULL CHECK (monthly_amount >= 0),
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE (shop_id, category_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'expense_categories', 'expenses', 'expense_attachments',
    'expense_history', 'category_budgets'
  ]
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
  ('expenses', 'Dépenses', 'Gestion des dépenses et bénéfice réel', 55)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  ('expenses:read',       'expenses', 'read',       'Consulter dépenses',     'Voir dépenses et rapports',           1),
  ('expenses:create',     'expenses', 'create',     'Enregistrer dépense',    'Créer une dépense',                   2),
  ('expenses:update',     'expenses', 'update',     'Modifier dépense',       'Corriger une dépense',                3),
  ('expenses:archive',    'expenses', 'archive',    'Supprimer dépense',      'Annuler / archiver une dépense',      4),
  ('expenses:categories', 'expenses', 'categories', 'Gérer catégories',       'Catégories et budgets de dépenses',   5)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow' FROM permissions WHERE code LIKE 'expenses:%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('seller', 'expenses:read', 'allow'),
  ('seller', 'expenses:create', 'allow'),
  ('viewer', 'expenses:read', 'allow')
ON CONFLICT DO NOTHING;
