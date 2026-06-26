export enum Permission {
  // Authentification
  AUTH_SESSION_TOUCH = 'auth:session:touch',
  AUTH_BIOMETRIC_ENABLE = 'auth:biometric:enable',

  // Tableau de bord
  DASHBOARD_READ = 'dashboard:read',
  DASHBOARD_FINANCIAL = 'dashboard:financial',

  // Inventaire
  INVENTORY_READ = 'inventory:read',
  INVENTORY_WRITE = 'inventory:write',
  INVENTORY_ADJUST = 'inventory:adjust',
  INVENTORY_ARCHIVE = 'inventory:archive',

  // Ventes
  SALES_CREATE = 'sales:create',
  SALES_READ = 'sales:read',
  SALES_CANCEL = 'sales:cancel',

  // Paiements
  PAYMENTS_CREATE = 'payments:create',
  PAYMENTS_READ = 'payments:read',

  // Clients
  CUSTOMERS_READ = 'customers:read',
  CUSTOMERS_WRITE = 'customers:write',
  CUSTOMERS_ARCHIVE = 'customers:archive',

  // Dettes
  DEBTS_READ = 'debts:read',
  DEBTS_PAYMENT = 'debts:payment',
  DEBTS_FORGIVE = 'debts:forgive',

  // Paramètres
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',

  // Utilisateurs & rôles
  USERS_READ = 'users:read',
  USERS_CREATE = 'users:create',
  USERS_UPDATE_ROLE = 'users:update_role',
  USERS_DEACTIVATE = 'users:deactivate',
  USERS_ASSIGN_SHOP = 'users:assign_shop',

  // RBAC (consultation & gestion)
  RBAC_READ = 'rbac:read',
  RBAC_MANAGE = 'rbac:manage',
  RBAC_OVERRIDE = 'rbac:override',

  // Audit
  AUDIT_READ = 'audit:read',

  // Rapports
  REPORTS_READ = 'reports:read',
  REPORTS_FINANCIAL = 'reports:financial',

  // Boutiques (multi-boutiques V3)
  SHOPS_READ = 'shops:read',
  SHOPS_CREATE = 'shops:create',
  SHOPS_UPDATE = 'shops:update',
  SHOPS_DEACTIVATE = 'shops:deactivate',
  SHOPS_SWITCH = 'shops:switch',
  SHOPS_CONSOLIDATED_READ = 'shops:consolidated_read',
}
