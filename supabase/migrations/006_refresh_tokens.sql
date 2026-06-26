-- VenteApp — Refresh tokens (rotation JWT)
-- Lié à auth_sessions — révoqué à la déconnexion ou rotation

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  user_id         BIGINT      NOT NULL REFERENCES users(id),
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  token_hash      TEXT        NOT NULL UNIQUE,
  expires_at      BIGINT      NOT NULL,
  revoked_at      BIGINT,
  replaced_by_id  UUID        REFERENCES refresh_tokens(id),
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id, shop_id);

DO $refresh_rls$
BEGIN
  EXECUTE 'ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS refresh_tokens_tenant_all ON refresh_tokens';
  EXECUTE $policy$
    CREATE POLICY refresh_tokens_tenant_all ON refresh_tokens
    FOR ALL USING (app_allows_shop(shop_id)) WITH CHECK (app_allows_shop(shop_id))
  $policy$;
END $refresh_rls$;
