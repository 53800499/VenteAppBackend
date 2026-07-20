-- ARIKE — Module Bureau de change (fx_exchange)

-- ---------------------------------------------------------------------------
-- fx_currencies (catalogue global)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_currencies (
  code         TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  symbol       TEXT NOT NULL,
  minor_unit   INT  NOT NULL DEFAULT 0,
  sort_order   INT  NOT NULL DEFAULT 0
);

INSERT INTO fx_currencies (code, label, symbol, minor_unit, sort_order) VALUES
  ('XOF', 'Franc CFA', 'FCFA', 0, 1),
  ('NGN', 'Naira nigérian', '₦', 2, 2),
  ('GHS', 'Cedi ghanéen', '₵', 2, 3),
  ('USD', 'Dollar US', '$', 2, 4),
  ('EUR', 'Euro', '€', 2, 5)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- fx_shop_currencies (devises actives par boutique)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_shop_currencies (
  id             BIGSERIAL PRIMARY KEY,
  shop_id        BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  currency_code  TEXT        NOT NULL REFERENCES fx_currencies(code),
  enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order     INT         NOT NULL DEFAULT 0,
  version        INTEGER     NOT NULL DEFAULT 1,
  server_id      UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status    TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at     BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at     BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE(shop_id, currency_code)
);

CREATE INDEX IF NOT EXISTS idx_fx_shop_currencies_shop ON fx_shop_currencies(shop_id);

-- ---------------------------------------------------------------------------
-- fx_rate_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_rate_snapshots (
  id                     BIGSERIAL PRIMARY KEY,
  shop_id                BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  base_currency          TEXT        NOT NULL DEFAULT 'XOF' REFERENCES fx_currencies(code),
  quote_currency         TEXT        NOT NULL REFERENCES fx_currencies(code),
  buy_rate_numerator     BIGINT      NOT NULL CHECK (buy_rate_numerator > 0),
  buy_rate_denominator   BIGINT      NOT NULL CHECK (buy_rate_denominator > 0),
  sell_rate_numerator    BIGINT      NOT NULL CHECK (sell_rate_numerator > 0),
  sell_rate_denominator  BIGINT      NOT NULL CHECK (sell_rate_denominator > 0),
  effective_at           BIGINT      NOT NULL,
  created_by             BIGINT      NOT NULL REFERENCES users(id),
  created_at             BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version                INTEGER     NOT NULL DEFAULT 1,
  server_id              UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status            TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_fx_rate_snapshots_shop
  ON fx_rate_snapshots(shop_id, quote_currency, effective_at DESC);

-- ---------------------------------------------------------------------------
-- fx_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_sessions (
  id                  BIGSERIAL PRIMARY KEY,
  shop_id             BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  opened_by           BIGINT      NOT NULL REFERENCES users(id),
  closed_by           BIGINT      REFERENCES users(id),
  opened_at           BIGINT      NOT NULL,
  closed_at           BIGINT,
  status              TEXT        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'closed')),
  closing_note        TEXT,
  total_margin_fcfa   BIGINT      NOT NULL DEFAULT 0,
  operation_count     INTEGER     NOT NULL DEFAULT 0,
  created_at          BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at          BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version             INTEGER     NOT NULL DEFAULT 1,
  server_id           UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status         TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_fx_sessions_shop_opened
  ON fx_sessions(shop_id, opened_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fx_sessions_one_open_per_shop
  ON fx_sessions(shop_id)
  WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- fx_session_balances
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_session_balances (
  id                BIGSERIAL PRIMARY KEY,
  shop_id           BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  session_id        BIGINT      NOT NULL REFERENCES fx_sessions(id) ON DELETE CASCADE,
  currency_code     TEXT        NOT NULL REFERENCES fx_currencies(code),
  opening_balance   BIGINT      NOT NULL DEFAULT 0,
  expected_balance  BIGINT,
  counted_balance   BIGINT,
  difference        BIGINT,
  version           INTEGER     NOT NULL DEFAULT 1,
  server_id         UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status       TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE(session_id, currency_code)
);

CREATE INDEX IF NOT EXISTS idx_fx_session_balances_session
  ON fx_session_balances(session_id);

-- ---------------------------------------------------------------------------
-- fx_operations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_operations (
  id                 BIGSERIAL PRIMARY KEY,
  shop_id            BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  session_id         BIGINT      NOT NULL REFERENCES fx_sessions(id) ON DELETE CASCADE,
  operation_type     TEXT        NOT NULL CHECK (operation_type IN ('buy', 'sell', 'adjustment')),
  from_currency      TEXT        NOT NULL REFERENCES fx_currencies(code),
  from_amount        BIGINT      NOT NULL CHECK (from_amount > 0),
  to_currency        TEXT        NOT NULL REFERENCES fx_currencies(code),
  to_amount          BIGINT      NOT NULL CHECK (to_amount > 0),
  rate_snapshot_id   BIGINT      REFERENCES fx_rate_snapshots(id),
  margin_fcfa        BIGINT      NOT NULL DEFAULT 0,
  note               TEXT,
  created_by         BIGINT      NOT NULL REFERENCES users(id),
  created_at         BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version            INTEGER     NOT NULL DEFAULT 1,
  server_id          UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status        TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_fx_operations_session
  ON fx_operations(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fx_operations_shop
  ON fx_operations(shop_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- fx_movements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_movements (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  session_id      BIGINT      NOT NULL REFERENCES fx_sessions(id) ON DELETE CASCADE,
  currency_code   TEXT        NOT NULL REFERENCES fx_currencies(code),
  movement_type   TEXT        NOT NULL CHECK (movement_type IN ('deposit', 'withdrawal', 'adjustment')),
  amount          BIGINT      NOT NULL CHECK (amount > 0),
  note            TEXT,
  created_by      BIGINT      NOT NULL REFERENCES users(id),
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_fx_movements_session
  ON fx_movements(session_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'fx_shop_currencies',
    'fx_rate_snapshots',
    'fx_sessions',
    'fx_session_balances',
    'fx_operations',
    'fx_movements'
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

ALTER TABLE fx_currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fx_currencies_read_all ON fx_currencies;
CREATE POLICY fx_currencies_read_all ON fx_currencies FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
INSERT INTO permission_modules (code, label, description, sort_order) VALUES
  ('fx_exchange', 'Bureau de change', 'Opérations multi-devises et gestion des taux', 65)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  ('fx_exchange:read', 'fx_exchange', 'read', 'Consulter le bureau de change', 'Voir soldes, opérations et taux', 1),
  ('fx_exchange:operate', 'fx_exchange', 'operate', 'Effectuer des opérations', 'Acheter / vendre des devises', 2),
  ('fx_exchange:rates', 'fx_exchange', 'rates', 'Gérer les taux', 'Saisir les taux du jour', 3),
  ('fx_exchange:session_open', 'fx_exchange', 'session_open', 'Ouvrir une session FX', 'Démarrer la journée de change', 4),
  ('fx_exchange:session_close', 'fx_exchange', 'session_close', 'Clôturer une session FX', 'Fin de journée de change', 5),
  ('fx_exchange:adjust', 'fx_exchange', 'adjust', 'Ajustements caisse FX', 'Corrections et soldes négatifs', 6),
  ('fx_exchange:report', 'fx_exchange', 'report', 'Rapports FX', 'Rapports et exports', 7),
  ('fx_exchange:configure', 'fx_exchange', 'configure', 'Configurer le bureau de change', 'Devises actives et paramètres', 8)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow' FROM permissions WHERE code LIKE 'fx_exchange:%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('seller', 'fx_exchange:read', 'allow'),
  ('seller', 'fx_exchange:operate', 'allow'),
  ('seller', 'fx_exchange:session_open', 'allow'),
  ('seller', 'fx_exchange:session_close', 'allow'),
  ('viewer', 'fx_exchange:read', 'allow'),
  ('viewer', 'fx_exchange:report', 'allow')
ON CONFLICT DO NOTHING;
