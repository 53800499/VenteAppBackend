-- VenteApp — Module Gestion de caisse (ouverture, suivi, clôture, offline-first)

-- ---------------------------------------------------------------------------
-- cash_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_sessions (
  id                BIGSERIAL PRIMARY KEY,
  shop_id           BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  opened_by         BIGINT      NOT NULL REFERENCES users(id),
  closed_by         BIGINT      REFERENCES users(id),
  opened_at         BIGINT      NOT NULL,
  closed_at         BIGINT,
  opening_cash      BIGINT      NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  opening_momo      BIGINT      NOT NULL DEFAULT 0 CHECK (opening_momo >= 0),
  sales_cash        BIGINT      NOT NULL DEFAULT 0,
  sales_momo        BIGINT      NOT NULL DEFAULT 0,
  expenses_cash     BIGINT      NOT NULL DEFAULT 0,
  expenses_momo     BIGINT      NOT NULL DEFAULT 0,
  deposits_cash     BIGINT      NOT NULL DEFAULT 0,
  deposits_momo     BIGINT      NOT NULL DEFAULT 0,
  withdrawals_cash  BIGINT      NOT NULL DEFAULT 0,
  withdrawals_momo  BIGINT      NOT NULL DEFAULT 0,
  expected_cash     BIGINT,
  expected_momo     BIGINT,
  counted_cash      BIGINT,
  counted_momo      BIGINT,
  difference_cash   BIGINT,
  difference_momo   BIGINT,
  sale_count        INTEGER     NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
  closing_note      TEXT,
  created_at        BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at        BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version           INTEGER     NOT NULL DEFAULT 1,
  server_id         UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status       TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_shop_opened
  ON cash_sessions(shop_id, opened_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_one_open_per_shop
  ON cash_sessions(shop_id)
  WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- cash_movements (retraits / entrées manuels)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_movements (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  session_id      BIGINT      NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  movement_type   TEXT        NOT NULL CHECK (movement_type IN ('deposit', 'withdrawal')),
  register_type   TEXT        NOT NULL DEFAULT 'cash'
                  CHECK (register_type IN ('cash', 'momo', 'mtn_momo', 'moov_money')),
  amount          BIGINT      NOT NULL CHECK (amount > 0),
  note            TEXT,
  created_by      BIGINT      NOT NULL REFERENCES users(id),
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session
  ON cash_movements(session_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['cash_sessions', 'cash_movements']
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
  ('cash_sessions', 'Gestion de caisse', 'Ouverture, suivi et clôture de caisse', 56)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  ('cash_sessions:read',   'cash_sessions', 'read',   'Consulter caisse',     'Voir sessions et historique',        1),
  ('cash_sessions:open',   'cash_sessions', 'open',   'Ouvrir caisse',        'Démarrer une session de caisse',     2),
  ('cash_sessions:close',  'cash_sessions', 'close',  'Clôturer caisse',      'Fermer et valider une session',      3),
  ('cash_sessions:adjust', 'cash_sessions', 'adjust', 'Ajuster caisse',       'Retraits et entrées manuelles',      4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow' FROM permissions WHERE code LIKE 'cash_sessions:%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('seller', 'cash_sessions:read', 'allow'),
  ('seller', 'cash_sessions:open', 'allow'),
  ('seller', 'cash_sessions:close', 'allow'),
  ('seller', 'cash_sessions:adjust', 'allow'),
  ('viewer', 'cash_sessions:read', 'allow')
ON CONFLICT DO NOTHING;
