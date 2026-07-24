import { Permission } from '../enums/permission.enum';
import { UserRole } from '../enums/user-role.enum';

const SELLER_PERMISSIONS: Permission[] = [
  Permission.AUTH_SESSION_TOUCH,
  Permission.AUTH_BIOMETRIC_ENABLE,
  Permission.DASHBOARD_READ,
  Permission.INVENTORY_READ,
  Permission.SALES_CREATE,
  Permission.SALES_READ,
  Permission.SALES_ORDERS_READ,
  Permission.SALES_ORDERS_WRITE,
  Permission.SALES_ORDERS_DELIVER,
  Permission.PAYMENTS_CREATE,
  Permission.PAYMENTS_READ,
  Permission.CUSTOMERS_READ,
  Permission.CUSTOMERS_WRITE,
  Permission.DEBTS_READ,
  Permission.DEBTS_PAYMENT,
  Permission.EXPENSES_READ,
  Permission.EXPENSES_CREATE,
  Permission.CASH_SESSIONS_READ,
  Permission.CASH_SESSIONS_OPEN,
  Permission.CASH_SESSIONS_CLOSE,
  Permission.CASH_SESSIONS_ADJUST,
  Permission.CALCULATORS_USE,
  Permission.CALCULATORS_EXPORT,
  Permission.CALCULATORS_HISTORY,
  Permission.PROCUREMENT_READ,
  Permission.PROCUREMENT_RECEIVE,
  Permission.INVENTORY_TRANSFER_READ,
  Permission.INVENTORY_TRANSFER_CREATE,
  Permission.INVENTORY_TRANSFER_RECEIVE,
];

const VIEWER_PERMISSIONS: Permission[] = [
  Permission.AUTH_SESSION_TOUCH,
  Permission.DASHBOARD_READ,
  Permission.INVENTORY_READ,
  Permission.SALES_READ,
  Permission.SALES_ORDERS_READ,
  Permission.PAYMENTS_READ,
  Permission.CUSTOMERS_READ,
  Permission.DEBTS_READ,
  Permission.REPORTS_READ,
  Permission.EXPENSES_READ,
  Permission.CASH_SESSIONS_READ,
  Permission.CALCULATORS_USE,
  Permission.CALCULATORS_HISTORY,
  Permission.PROCUREMENT_READ,
  Permission.INVENTORY_TRANSFER_READ,
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: Object.values(Permission),
  [UserRole.SELLER]: SELLER_PERMISSIONS,
  [UserRole.VIEWER]: VIEWER_PERMISSIONS,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.OWNER]: 'Patron',
  [UserRole.SELLER]: 'Vendeur',
  [UserRole.VIEWER]: 'Lecteur',
};
