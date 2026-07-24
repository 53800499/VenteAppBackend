-- Permissions RBAC pour le module Commandes clients (sales_orders)
-- Sans ce seed, le resolver DB refuse les appels API (403) malgré le map TypeScript.

INSERT INTO permission_modules (code, label, description, sort_order)
VALUES (
  'sales_orders',
  'Commandes clients',
  'Commandes différées, livraisons partielles et clôture',
  55
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module_code, action, label, description, sort_order) VALUES
  (
    'sales_orders:read',
    'sales_orders',
    'read',
    'Consulter les commandes clients',
    'Voir la liste et le détail des commandes',
    1
  ),
  (
    'sales_orders:write',
    'sales_orders',
    'write',
    'Gérer les commandes clients',
    'Créer, confirmer, préparer, annuler et clôturer',
    2
  ),
  (
    'sales_orders:deliver',
    'sales_orders',
    'deliver',
    'Livrer une commande client',
    'Enregistrer une livraison (accepté / refusé / remplacé)',
    3
  )
ON CONFLICT (code) DO NOTHING;

-- Patron : toutes les permissions du module
INSERT INTO role_permissions (role_code, permission_code, effect)
SELECT 'owner', code, 'allow'
FROM permissions
WHERE code LIKE 'sales_orders:%'
ON CONFLICT DO NOTHING;

-- Vendeur : lecture + écriture + livraison (aligné ROLE_PERMISSIONS)
INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('seller', 'sales_orders:read', 'allow'),
  ('seller', 'sales_orders:write', 'allow'),
  ('seller', 'sales_orders:deliver', 'allow')
ON CONFLICT DO NOTHING;

-- Lecteur : lecture seule
INSERT INTO role_permissions (role_code, permission_code, effect) VALUES
  ('viewer', 'sales_orders:read', 'allow')
ON CONFLICT DO NOTHING;
