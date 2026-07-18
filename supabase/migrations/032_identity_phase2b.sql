-- Phase 2b : identité globale (phone unique) + rôle effectif par boutique

CREATE TABLE IF NOT EXISTS identities (
  id            BIGSERIAL PRIMARY KEY,
  phone         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identities_phone ON identities(phone);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS identity_id BIGINT REFERENCES identities(id);

CREATE INDEX IF NOT EXISTS idx_users_identity ON users(identity_id);

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS identity_id BIGINT REFERENCES identities(id);

CREATE INDEX IF NOT EXISTS idx_memberships_identity ON memberships(identity_id);

ALTER TABLE shop_access
  ADD COLUMN IF NOT EXISTS access_role TEXT REFERENCES roles(code);

COMMENT ON COLUMN shop_access.access_role IS
  'Rôle effectif dans cette boutique. NULL = hériter du membership.role';

-- Identités depuis les numéros WhatsApp existants
INSERT INTO identities (phone, display_name, created_at, updated_at)
SELECT
  u.phone,
  MAX(u.name),
  MIN(COALESCE(u.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)),
  MAX(COALESCE(u.updated_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT))
FROM users u
WHERE u.phone IS NOT NULL
  AND TRIM(u.phone) <> ''
GROUP BY u.phone
ON CONFLICT (phone) DO NOTHING;

UPDATE users u
SET identity_id = i.id
FROM identities i
WHERE i.phone = u.phone
  AND u.phone IS NOT NULL
  AND TRIM(u.phone) <> ''
  AND u.identity_id IS NULL;

UPDATE memberships m
SET identity_id = u.identity_id
FROM users u
WHERE u.id = m.user_id
  AND u.identity_id IS NOT NULL
  AND m.identity_id IS NULL;

-- Accès explicite via shop_access (helper RLS / permissions)
CREATE OR REPLACE FUNCTION user_has_shop_access(p_user_id BIGINT, p_shop_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m
    JOIN shop_access sa ON sa.membership_id = m.id
    JOIN shops s ON s.id = sa.shop_id AND s.is_active = TRUE
    WHERE m.user_id = p_user_id
      AND sa.shop_id = p_shop_id
  );
$$;

CREATE OR REPLACE FUNCTION resolve_effective_role(p_user_id BIGINT, p_shop_id BIGINT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(sa.access_role, m.role)
  FROM memberships m
  JOIN shop_access sa ON sa.membership_id = m.id
  WHERE m.user_id = p_user_id
    AND sa.shop_id = p_shop_id
  ORDER BY m.is_primary DESC, m.id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION user_has_shop_access(BIGINT, BIGINT)
  TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION resolve_effective_role(BIGINT, BIGINT)
  TO service_role, authenticated, anon;

-- Renforce app_allows_shop : boutique courante OU accès explicite du user session
CREATE OR REPLACE FUNCTION app_allows_shop(p_shop_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  current_shop BIGINT;
  v_session_user_id BIGINT;
BEGIN
  current_shop := app_current_shop_id();
  IF current_shop IS NULL THEN
    RETURN TRUE;
  END IF;
  IF current_shop = p_shop_id THEN
    RETURN TRUE;
  END IF;

  BEGIN
    v_session_user_id := NULLIF(current_setting('app.current_user_id', TRUE), '')::BIGINT;
  EXCEPTION WHEN OTHERS THEN
    v_session_user_id := NULL;
  END;

  IF v_session_user_id IS NOT NULL AND user_has_shop_access(v_session_user_id, p_shop_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
