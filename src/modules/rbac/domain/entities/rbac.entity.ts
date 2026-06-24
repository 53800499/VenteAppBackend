export type PermissionEffect = 'allow' | 'deny';
export type OverrideEffect = 'grant' | 'deny';
export type RoleScope = 'system' | 'shop';

export interface PermissionModule {
  readonly code: string;
  readonly label: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
}

export interface PermissionDefinition {
  readonly code: string;
  readonly moduleCode: string;
  readonly action: string;
  readonly label: string | null;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly isSystem: boolean;
  readonly sortOrder: number;
}

export interface RoleDefinition {
  readonly code: string;
  readonly label: string;
  readonly description: string | null;
  readonly scope: RoleScope;
  readonly shopId: number | null;
  readonly priority: number;
  readonly isActive: boolean;
  readonly isSystem: boolean;
}

export interface RolePermissionGrant {
  readonly permissionCode: string;
  readonly effect: PermissionEffect;
}

export interface UserPermissionOverride {
  readonly id: number;
  readonly userId: number;
  readonly shopId: number;
  readonly permissionCode: string;
  readonly effect: OverrideEffect;
  readonly reason: string | null;
  readonly grantedBy: number | null;
  readonly expiresAt: number | null;
  readonly isActive: boolean;
}

export interface CreateShopRoleInput {
  code: string;
  label: string;
  description?: string;
  shopId: number;
  parentRoleCode?: string;
  permissions: RolePermissionGrant[];
}

export interface UpdateShopRoleInput {
  label?: string;
  description?: string;
  isActive?: boolean;
  permissions?: RolePermissionGrant[];
}

export interface CreateOverrideInput {
  userId: number;
  shopId: number;
  permissionCode: string;
  effect: OverrideEffect;
  reason?: string;
  grantedBy: number;
  expiresAt?: number;
}
