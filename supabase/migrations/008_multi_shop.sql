-- VenteApp — Module Gestion Multi-boutiques (RG-SHOP-04 à RG-SHOP-08)
-- Permissions shops:*, index patron, RLS lecture multi-boutiques owner

CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_user_id);

-- ---------------------------------------------------------------------------
-- RBAC : module boutiques
-- ---------------------------------------------------------------------------
INSERT INTO permission_modules (code, label, description, sort_order) VALUES
  ('shops', 'Boutiques', 'Gestion multi-boutiques (patron)', 85)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  ('shops:read',             'shops', 'read',             'Lister boutiques',      'Voir ses boutiques',                    1),
  ('shops:create',           'shops', 'create',           'Créer boutique',        'Ajouter une boutique',                  2),
  ('shops:update',           'shops', 'update',           'Modifier boutique',     'Éditer identité boutique',              3),
  ('shops:deactivate',       'shops', 'deactivate',       'Désactiver boutique',   'Fermer sans supprimer (RG-SHOP-08)',    4),
  ('shops:switch',           'shops', 'switch',           'Changer boutique',      'Basculer la boutique active',           5),
  ('shops:consolidated_read','shops', 'consolidated_read','Vue consolidée',        'Stats multi-boutiques (RG-SHOP-07)',    6)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow' FROM permissions WHERE code LIKE 'shops:%'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS shops : le patron peut lister toutes ses boutiques (owner_user_id)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS shops_owner_list ON shops;
CREATE POLICY shops_owner_list ON shops
  FOR SELECT USING (
    app_allows_shop(id)
    OR (
      app_current_shop_id() IS NOT NULL
      AND owner_user_id IS NOT NULL
      AND owner_user_id = (
        SELECT u.id FROM users u
        WHERE u.id = owner_user_id
          AND u.shop_id = app_current_shop_id()
        LIMIT 1
      )
    )
  );
