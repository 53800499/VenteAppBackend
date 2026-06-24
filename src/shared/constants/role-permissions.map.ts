import { Permission } from '../enums/permission.enum';
import { UserRole } from '../enums/user-role.enum';

const SELLER_PERMISSIONS: Permission[] = [
  Permission.AUTH_SESSION_TOUCH,
  Permission.AUTH_BIOMETRIC_ENABLE,
  Permission.DASHBOARD_READ,
  Permission.INVENTORY_READ,
  Permission.SALES_CREATE,
  Permission.SALES_READ,
  Permission.PAYMENTS_CREATE,
  Permission.PAYMENTS_READ,
  Permission.CUSTOMERS_READ,
  Permission.CUSTOMERS_WRITE,
  Permission.DEBTS_READ,
  Permission.DEBTS_PAYMENT,
];

const VIEWER_PERMISSIONS: Permission[] = [
  Permission.AUTH_SESSION_TOUCH,
  Permission.DASHBOARD_READ,
  Permission.INVENTORY_READ,
  Permission.SALES_READ,
  Permission.PAYMENTS_READ,
  Permission.CUSTOMERS_READ,
  Permission.DEBTS_READ,
  Permission.REPORTS_READ,
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
