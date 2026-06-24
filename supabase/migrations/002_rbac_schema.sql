-- VenteApp — RBAC évolutif (Module rôles & permissions)
-- Tables flexibles : modules, permissions, rôles, héritage, overrides utilisateur

-- ---------------------------------------------------------------------------
-- permission_modules — regroupement logique (évolutif via metadata JSONB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permission_modules (
  code          TEXT        PRIMARY KEY,
  label         TEXT        NOT NULL,
  description   TEXT,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at    BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- ---------------------------------------------------------------------------
-- permissions — catalogue extensible
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  code          TEXT        PRIMARY KEY,
  module_code   TEXT        NOT NULL REFERENCES permission_modules(code),
  action        TEXT        NOT NULL,
  label         TEXT,
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  is_system     BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at    BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module_code);
CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(is_active);

-- ---------------------------------------------------------------------------
-- roles — système (global) ou boutique (shop-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  code          TEXT        PRIMARY KEY,
  label         TEXT        NOT NULL,
  description   TEXT,
  scope         TEXT        NOT NULL CHECK (scope IN ('system', 'shop')),
  shop_id       BIGINT      REFERENCES shops(id) ON DELETE CASCADE,
  priority      INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  is_system     BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at    BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  CONSTRAINT roles_scope_shop_check CHECK (
    (scope = 'system' AND shop_id IS NULL) OR
    (scope = 'shop' AND shop_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_roles_shop ON roles(shop_id);
CREATE INDEX IF NOT EXISTS idx_roles_scope ON roles(scope);

-- ---------------------------------------------------------------------------
-- role_permissions — allow/deny par rôle (conditions JSONB pour règles futures)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  role_code         TEXT        NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code   TEXT        NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  effect            TEXT        NOT NULL DEFAULT 'allow'
                    CHECK (effect IN ('allow', 'deny')),
  conditions        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (role_code, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_code);

-- ---------------------------------------------------------------------------
-- role_inheritance — un rôle enfant hérite des permissions du parent
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_inheritance (
  child_role_code   TEXT        NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  parent_role_code  TEXT        NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  created_at        BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (child_role_code, parent_role_code),
  CHECK (child_role_code <> parent_role_code)
);

-- ---------------------------------------------------------------------------
-- user_permission_overrides — exceptions granulaires par utilisateur
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id           BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  permission_code   TEXT        NOT NULL REFERENCES permissions(code),
  effect            TEXT        NOT NULL CHECK (effect IN ('grant', 'deny')),
  reason            TEXT,
  granted_by        BIGINT      REFERENCES users(id),
  expires_at        BIGINT,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at        BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE (user_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_user_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_overrides_shop ON user_permission_overrides(shop_id);

-- ---------------------------------------------------------------------------
-- FK users.role → roles.code (remplace le CHECK inline)
-- ---------------------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_fkey;
ALTER TABLE users
  ADD CONSTRAINT users_role_fkey
  FOREIGN KEY (role) REFERENCES roles(code);

-- ---------------------------------------------------------------------------
-- Seed : modules
-- ---------------------------------------------------------------------------
INSERT INTO permission_modules (code, label, description, sort_order) VALUES
  ('auth',       'Authentification',  'Sessions et biométrie',           10),
  ('dashboard',  'Tableau de bord',   'Indicateurs et synthèses',        20),
  ('inventory',  'Inventaire',        'Stock et produits',               30),
  ('sales',      'Ventes',            'Encaissement et annulations',     40),
  ('payments',   'Paiements',         'Modes de paiement',               50),
  ('customers',  'Clients',           'Fichier clients',                 60),
  ('debts',      'Dettes',            'Créances et remboursements',      70),
  ('settings',   'Paramètres',        'Configuration boutique',          80),
  ('users',      'Utilisateurs',      'Gestion des comptes',             90),
  ('rbac',       'Rôles & droits',    'RBAC et permissions',            100),
  ('audit',      'Audit',             'Journal d''activité',            110),
  ('reports',    'Rapports',          'Exports et analyses',            120)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed : permissions (catalogue V1 + gestion RBAC avancée)
-- ---------------------------------------------------------------------------
INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  ('auth:session:touch',     'auth',      'session:touch',     'Prolonger session',       'Toucher la session active',                    1),
  ('auth:biometric:enable',  'auth',      'biometric:enable',  'Activer biométrie',       'Enregistrer l''empreinte / Face ID',           2),
  ('dashboard:read',         'dashboard', 'read',              'Voir tableau de bord',    'Accès lecture au tableau de bord',             1),
  ('dashboard:financial',    'dashboard', 'financial',         'Données financières',     'Voir les indicateurs financiers',                2),
  ('inventory:read',         'inventory', 'read',              'Lire inventaire',         'Consulter le stock',                           1),
  ('inventory:write',        'inventory', 'write',             'Modifier inventaire',     'Créer / éditer des produits',                  2),
  ('inventory:adjust',       'inventory', 'adjust',            'Ajuster stock',           'Corrections de stock',                         3),
  ('inventory:archive',      'inventory', 'archive',           'Archiver produit',        'Archiver un article',                          4),
  ('sales:create',           'sales',     'create',            'Créer vente',             'Enregistrer une vente',                        1),
  ('sales:read',             'sales',     'read',              'Lire ventes',             'Consulter l''historique des ventes',           2),
  ('sales:cancel',           'sales',     'cancel',            'Annuler vente',           'Annuler une vente',                            3),
  ('payments:create',        'payments',  'create',            'Enregistrer paiement',    'Saisir un paiement',                           1),
  ('payments:read',          'payments',  'read',              'Lire paiements',          'Consulter les paiements',                      2),
  ('customers:read',         'customers', 'read',              'Lire clients',            'Consulter le fichier clients',                 1),
  ('customers:write',        'customers', 'write',             'Modifier clients',        'Créer / éditer des clients',                   2),
  ('customers:archive',      'customers', 'archive',           'Archiver client',         'Archiver un client',                           3),
  ('debts:read',             'debts',     'read',              'Lire dettes',             'Consulter les créances',                       1),
  ('debts:payment',          'debts',     'payment',           'Enregistrer remboursement','Saisir un remboursement',                     2),
  ('debts:forgive',          'debts',     'forgive',           'Annuler dette',           'Radier une dette',                             3),
  ('settings:read',          'settings',  'read',              'Lire paramètres',         'Consulter la configuration',                   1),
  ('settings:write',         'settings',  'write',             'Modifier paramètres',     'Modifier la configuration boutique',           2),
  ('users:read',             'users',     'read',              'Lister utilisateurs',     'Voir les comptes de la boutique',              1),
  ('users:create',           'users',     'create',            'Créer utilisateur',       'Ajouter vendeur ou lecteur',                    2),
  ('users:update_role',      'users',     'update_role',       'Changer rôle',            'Modifier le rôle d''un utilisateur',           3),
  ('users:deactivate',       'users',     'deactivate',        'Désactiver utilisateur',  'Désactiver un compte',                         4),
  ('rbac:read',              'rbac',      'read',              'Consulter RBAC',          'Voir rôles et permissions',                    1),
  ('rbac:manage',            'rbac',      'manage',            'Gérer rôles',             'Créer / modifier des rôles boutique',        2),
  ('rbac:override',          'rbac',      'override',          'Overrides utilisateur',   'Accorder ou révoquer des droits individuels',  3),
  ('audit:read',             'audit',     'read',              'Lire audit',              'Consulter le journal d''audit',                1),
  ('reports:read',           'reports',   'read',              'Lire rapports',           'Consulter les rapports',                       1),
  ('reports:financial',      'reports',   'financial',         'Rapports financiers',     'Rapports financiers détaillés',                2)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed : rôles système
-- ---------------------------------------------------------------------------
INSERT INTO roles (code, label, description, scope, is_system, priority) VALUES
  ('owner',  'Patron',  'Accès complet à la boutique',              'system', TRUE, 100),
  ('seller', 'Vendeur', 'Ventes, clients et opérations courantes',  'system', TRUE, 50),
  ('viewer', 'Lecteur', 'Consultation en lecture seule',            'system', TRUE, 10)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed : permissions par rôle (aligné sur role-permissions.map.ts)
-- ---------------------------------------------------------------------------
INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow' FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('seller', 'auth:session:touch', 'allow'),
  ('seller', 'auth:biometric:enable', 'allow'),
  ('seller', 'dashboard:read', 'allow'),
  ('seller', 'inventory:read', 'allow'),
  ('seller', 'sales:create', 'allow'),
  ('seller', 'sales:read', 'allow'),
  ('seller', 'payments:create', 'allow'),
  ('seller', 'payments:read', 'allow'),
  ('seller', 'customers:read', 'allow'),
  ('seller', 'customers:write', 'allow'),
  ('seller', 'debts:read', 'allow'),
  ('seller', 'debts:payment', 'allow')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('viewer', 'auth:session:touch', 'allow'),
  ('viewer', 'dashboard:read', 'allow'),
  ('viewer', 'inventory:read', 'allow'),
  ('viewer', 'sales:read', 'allow'),
  ('viewer', 'payments:read', 'allow'),
  ('viewer', 'customers:read', 'allow'),
  ('viewer', 'debts:read', 'allow'),
  ('viewer', 'reports:read', 'allow')
ON CONFLICT DO NOTHING;

-- Héritage optionnel : seller hérite de viewer (permissions supplémentaires ajoutées ci-dessus)
INSERT INTO role_inheritance (child_role_code, parent_role_code) VALUES
  ('seller', 'viewer')
ON CONFLICT DO NOTHING;
