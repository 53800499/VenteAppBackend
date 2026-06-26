-- VenteApp — Fusion auth_sessions + refresh_tokens → user_sessions (1 ligne = 1 appareil)
-- device_id : UUID stable côté client (secure storage Flutter)

CREATE TABLE IF NOT EXISTS user_sessions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               BIGINT      NOT NULL REFERENCES users(id),
  shop_id               BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  device_id             TEXT        NOT NULL,
  device_label          TEXT,
  refresh_token_hash    TEXT        NOT NULL UNIQUE,
  pin_verified_at       BIGINT      NOT NULL,
  last_seen_at          BIGINT      NOT NULL,
  session_expires_at    BIGINT      NOT NULL,
  refresh_expires_at    BIGINT      NOT NULL,
  revoked_at            BIGINT,
  replaced_by_id        UUID        REFERENCES user_sessions(id),
  created_at            BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_shop
  ON user_sessions(user_id, shop_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_shop_active
  ON user_sessions(shop_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_device
  ON user_sessions(shop_id, user_id, device_id);

-- Remplacement des tables précédentes (Module JWT)
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS auth_sessions CASCADE;

DO $user_sessions_rls$
BEGIN
  EXECUTE 'ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS user_sessions_tenant_all ON user_sessions';
  EXECUTE $policy$
    CREATE POLICY user_sessions_tenant_all ON user_sessions
    FOR ALL USING (app_allows_shop(shop_id)) WITH CHECK (app_allows_shop(shop_id))
  $policy$;
END $user_sessions_rls$;
