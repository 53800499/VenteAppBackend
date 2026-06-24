export enum AuditAction {
  EMERGENCY_UNLOCK = 'emergency_unlock',
  USER_ROLE_CHANGED = 'user_role_changed',
  DEBT_CREATED = 'debt_created',
  SALE_CANCELLED = 'sale_cancelled',
}

export enum AuditModule {
  AUTH = 'auth',
  SETTINGS = 'settings',
  USERS = 'users',
  SALES = 'sales',
  DEBTS = 'debts',
}
