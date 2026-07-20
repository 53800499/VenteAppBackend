-- ARIKE — Taux figés par session FX (gel à l'ouverture + changement contrôlé)

CREATE TABLE IF NOT EXISTS fx_session_rates (
  id                 BIGSERIAL PRIMARY KEY,
  shop_id            BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  session_id         BIGINT      NOT NULL REFERENCES fx_sessions(id) ON DELETE CASCADE,
  quote_currency     TEXT        NOT NULL REFERENCES fx_currencies(code),
  rate_snapshot_id   BIGINT      NOT NULL REFERENCES fx_rate_snapshots(id),
  applied_at         BIGINT      NOT NULL,
  version            INTEGER     NOT NULL DEFAULT 1,
  server_id          UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status        TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  UNIQUE (session_id, quote_currency)
);

CREATE INDEX IF NOT EXISTS idx_fx_session_rates_shop_session
  ON fx_session_rates(shop_id, session_id);
