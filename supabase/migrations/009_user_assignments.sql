-- VenteApp — Attribution utilisateurs (boutique + permissions)
-- Permission users:assign_shop pour réaffecter un vendeur/lecteur entre boutiques possédées

INSERT INTO permissions (code, module_code, action, label, description, sort_order)
VALUES (
  'users:assign_shop',
  'users',
  'assign_shop',
  'Affecter boutique',
  'Réaffecter un vendeur ou lecteur à une autre boutique',
  5
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, effect)
VALUES ('owner', 'users:assign_shop', 'allow')
ON CONFLICT (role_code, permission_code) DO NOTHING;
