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

  // Dépenses
  EXPENSES_READ = 'expenses:read',
  EXPENSES_CREATE = 'expenses:create',
  EXPENSES_UPDATE = 'expenses:update',
  EXPENSES_ARCHIVE = 'expenses:archive',
  EXPENSES_CATEGORIES = 'expenses:categories',

  // Gestion de caisse
  CASH_SESSIONS_READ = 'cash_sessions:read',
  CASH_SESSIONS_OPEN = 'cash_sessions:open',
  CASH_SESSIONS_CLOSE = 'cash_sessions:close',
  CASH_SESSIONS_ADJUST = 'cash_sessions:adjust',

  // Boutiques (multi-boutiques V3)
  SHOPS_READ = 'shops:read',
  SHOPS_CREATE = 'shops:create',
  SHOPS_UPDATE = 'shops:update',
  SHOPS_DEACTIVATE = 'shops:deactivate',
  SHOPS_SWITCH = 'shops:switch',
  SHOPS_CONSOLIDATED_READ = 'shops:consolidated_read',

  // Calculateurs
  CALCULATORS_USE = 'calculators:use',
  CALCULATORS_EXPORT = 'calculators:export',
  CALCULATORS_HISTORY = 'calculators:history',

  // Approvisionnements (Procurement)
  PROCUREMENT_READ = 'procurement:read',
  PROCUREMENT_CREATE = 'procurement:create',
  PROCUREMENT_UPDATE = 'procurement:update',
  PROCUREMENT_RECEIVE = 'procurement:receive',
  PROCUREMENT_INVOICE_PAY = 'procurement:invoice_pay',
  PROCUREMENT_CANCEL = 'procurement:cancel',

  // Transferts inter-boutiques
  INVENTORY_TRANSFER_READ = 'inventory:transfer:read',
  INVENTORY_TRANSFER_CREATE = 'inventory:transfer:create',
  INVENTORY_TRANSFER_RECEIVE = 'inventory:transfer:receive',
}
