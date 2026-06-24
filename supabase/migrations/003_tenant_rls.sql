-- VenteApp — Isolation multi-boutique (RLS + contexte session PostgreSQL)
--
-- ORDRE D'EXÉCUTION OBLIGATOIRE :
--   1. 001_auth_schema.sql
--   2. 002_rbac_schema.sql
--   3. 003_tenant_rls.sql  (ce fichier)
--
-- Le backend appelle app_set_shop_id(shop_id) avant les requêtes métier.
-- app_current_shop_id() IS NULL autorise les opérations système (setup initial).

-- ---------------------------------------------------------------------------
-- Fonctions de contexte tenant (transaction-local)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_shop_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.shop_id', true), '')::bigint;
$$;

CREATE OR REPLACE FUNCTION app_set_shop_id(p_shop_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_shop_id IS NULL OR p_shop_id <= 0 THEN
    RAISE EXCEPTION 'app_set_shop_id: shop_id invalide (%)', p_shop_id;
  END IF;
  PERFORM set_config('app.shop_id', p_shop_id::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION app_clear_shop_id()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.shop_id', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_tenant_is_set()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_shop_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION app_allows_shop(p_shop_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_shop_id() IS NULL OR app_current_shop_id() = p_shop_id;
$$;

GRANT EXECUTE ON FUNCTION app_set_shop_id(BIGINT) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION app_clear_shop_id() TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION app_current_shop_id() TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION app_tenant_is_set() TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION app_allows_shop(BIGINT) TO service_role, authenticated, anon;

-- ---------------------------------------------------------------------------
-- RLS : tables Module Auth (001)
-- ---------------------------------------------------------------------------

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shops_tenant_select ON shops;
DROP POLICY IF EXISTS shops_tenant_insert ON shops;
DROP POLICY IF EXISTS shops_tenant_update ON shops;

CREATE POLICY shops_tenant_select ON shops
  FOR SELECT USING (app_allows_shop(id));

CREATE POLICY shops_tenant_insert ON shops
  FOR INSERT WITH CHECK (app_current_shop_id() IS NULL OR app_current_shop_id() = id);

CREATE POLICY shops_tenant_update ON shops
  FOR UPDATE USING (app_allows_shop(id)) WITH CHECK (app_allows_shop(id));

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_tenant_all ON users;
CREATE POLICY users_tenant_all ON users
  FOR ALL
  USING (app_allows_shop(shop_id))
  WITH CHECK (app_allows_shop(shop_id));

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_tenant_all ON settings;
CREATE POLICY settings_tenant_all ON settings
  FOR ALL
  USING (app_allows_shop(shop_id))
  WITH CHECK (app_allows_shop(shop_id));

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_tenant_all ON audit_logs;
CREATE POLICY audit_logs_tenant_all ON audit_logs
  FOR ALL
  USING (app_allows_shop(shop_id))
  WITH CHECK (app_allows_shop(shop_id));

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_sessions_tenant_all ON auth_sessions;
CREATE POLICY auth_sessions_tenant_all ON auth_sessions
  FOR ALL
  USING (app_allows_shop(shop_id))
  WITH CHECK (app_allows_shop(shop_id));

-- ---------------------------------------------------------------------------
-- RLS : tables RBAC (002) — ignoré si 002_rbac_schema.sql n'est pas encore appliqué
-- ---------------------------------------------------------------------------
DO $rbac_rls$
BEGIN
  IF to_regclass('public.roles') IS NULL THEN
    RAISE WARNING '002_rbac_schema.sql non appliquée — RLS RBAC ignoré. Exécutez 002 puis relancez ce fichier.';
    RETURN;
  END IF;

  ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_permission_overrides FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS user_overrides_tenant_all ON user_permission_overrides;
  CREATE POLICY user_overrides_tenant_all ON user_permission_overrides
    FOR ALL
    USING (app_allows_shop(shop_id))
    WITH CHECK (app_allows_shop(shop_id));

  ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE roles FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS roles_tenant_select ON roles;
  DROP POLICY IF EXISTS roles_tenant_write ON roles;
  DROP POLICY IF EXISTS roles_tenant_update ON roles;
  DROP POLICY IF EXISTS roles_tenant_delete ON roles;

  CREATE POLICY roles_tenant_select ON roles
    FOR SELECT USING (
      app_current_shop_id() IS NULL
      OR scope = 'system'
      OR shop_id = app_current_shop_id()
    );

  CREATE POLICY roles_tenant_write ON roles
    FOR INSERT WITH CHECK (
      scope = 'shop' AND shop_id = app_current_shop_id()
    );

  CREATE POLICY roles_tenant_update ON roles
    FOR UPDATE USING (
      scope = 'shop' AND shop_id = app_current_shop_id()
    ) WITH CHECK (
      scope = 'shop' AND shop_id = app_current_shop_id()
    );

  CREATE POLICY roles_tenant_delete ON roles
    FOR DELETE USING (
      scope = 'shop' AND shop_id = app_current_shop_id()
    );

  ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS role_permissions_tenant_all ON role_permissions;
  CREATE POLICY role_permissions_tenant_all ON role_permissions
    FOR ALL USING (
      app_current_shop_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM roles r
        WHERE r.code = role_permissions.role_code
          AND (r.scope = 'system' OR r.shop_id = app_current_shop_id())
      )
    )
    WITH CHECK (
      app_current_shop_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM roles r
        WHERE r.code = role_permissions.role_code
          AND r.scope = 'shop' AND r.shop_id = app_current_shop_id()
      )
    );

  ALTER TABLE role_inheritance ENABLE ROW LEVEL SECURITY;
  ALTER TABLE role_inheritance FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS role_inheritance_tenant_all ON role_inheritance;
  CREATE POLICY role_inheritance_tenant_all ON role_inheritance
    FOR ALL USING (
      app_current_shop_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM roles r
        WHERE r.code = role_inheritance.child_role_code
          AND (r.scope = 'system' OR r.shop_id = app_current_shop_id())
      )
    );

  ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE permission_modules ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS permissions_read_all ON permissions;
  CREATE POLICY permissions_read_all ON permissions FOR SELECT USING (true);
  DROP POLICY IF EXISTS permission_modules_read_all ON permission_modules;
  CREATE POLICY permission_modules_read_all ON permission_modules FOR SELECT USING (true);

  RAISE NOTICE 'RLS RBAC appliqué avec succès.';
END $rbac_rls$;
