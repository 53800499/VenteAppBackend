-- Phase 2 identité : Organization (boutique racine) + Membership + ShopAccess

CREATE TABLE IF NOT EXISTS organizations (
  id              BIGSERIAL PRIMARY KEY,
  root_shop_id    BIGINT NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  created_at      BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_root_shop ON organizations(root_shop_id);

CREATE TABLE IF NOT EXISTS memberships (
  id               BIGSERIAL PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL REFERENCES roles(code),
  is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       BIGINT NOT NULL,
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(organization_id);

CREATE TABLE IF NOT EXISTS shop_access (
  membership_id  BIGINT NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  shop_id        BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at     BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (membership_id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_access_shop ON shop_access(shop_id);

-- Résout la boutique racine d'un réseau (aligné ShopHierarchyService).
CREATE OR REPLACE FUNCTION resolve_shop_root(p_shop_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  current_id BIGINT := p_shop_id;
  parent_id  BIGINT;
  depth      INT := 0;
BEGIN
  IF current_id IS NULL THEN
    RETURN NULL;
  END IF;

  LOOP
    SELECT s.parent_shop_id INTO parent_id FROM shops s WHERE s.id = current_id;
    EXIT WHEN parent_id IS NULL OR depth >= 10;
    current_id := parent_id;
    depth := depth + 1;
  END LOOP;

  RETURN current_id;
END;
$$;

-- Backfill organisations depuis les boutiques racines actives.
INSERT INTO organizations (root_shop_id, name, created_at)
SELECT DISTINCT
  resolve_shop_root(s.id) AS root_id,
  COALESCE(root_shop.name, s.name),
  COALESCE(s.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
FROM shops s
JOIN shops root_shop ON root_shop.id = resolve_shop_root(s.id)
WHERE s.is_active = TRUE
ON CONFLICT (root_shop_id) DO NOTHING;

-- Patrons : un membership par (user, organisation).
INSERT INTO memberships (organization_id, user_id, role, is_primary, created_at)
SELECT DISTINCT
  o.id,
  u.id,
  u.role,
  TRUE,
  COALESCE(u.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
FROM users u
JOIN shops owned ON owned.owner_user_id = u.id AND owned.is_active = TRUE
JOIN organizations o ON o.root_shop_id = resolve_shop_root(owned.id)
WHERE u.role = 'owner'
  AND u.is_active = TRUE
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Staff : membership sur l'organisation de leur boutique d'affectation.
INSERT INTO memberships (organization_id, user_id, role, is_primary, created_at)
SELECT DISTINCT
  o.id,
  u.id,
  u.role,
  TRUE,
  COALESCE(u.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
FROM users u
JOIN organizations o ON o.root_shop_id = resolve_shop_root(u.shop_id)
WHERE u.role <> 'owner'
  AND u.is_active = TRUE
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Accès boutiques : patron → toutes les boutiques du groupe hiérarchique possédées.
INSERT INTO shop_access (membership_id, shop_id, created_at)
SELECT DISTINCT
  m.id,
  s.id,
  COALESCE(s.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
FROM memberships m
JOIN users u ON u.id = m.user_id AND u.role = 'owner'
JOIN shops s ON s.owner_user_id = u.id AND s.is_active = TRUE
JOIN organizations o ON o.id = m.organization_id
WHERE resolve_shop_root(s.id) = o.root_shop_id
ON CONFLICT DO NOTHING;

-- Accès boutiques : staff → boutique d'affectation uniquement.
INSERT INTO shop_access (membership_id, shop_id, created_at)
SELECT DISTINCT
  m.id,
  u.shop_id,
  COALESCE(u.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
FROM memberships m
JOIN users u ON u.id = m.user_id AND u.role <> 'owner' AND u.is_active = TRUE
ON CONFLICT DO NOTHING;
