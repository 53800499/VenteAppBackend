import {
  CreateOverrideInput,
  CreateShopRoleInput,
  PermissionDefinition,
  PermissionModule,
  RoleDefinition,
  RolePermissionGrant,
  UpdateShopRoleInput,
  UserPermissionOverride,
} from '../entities/rbac.entity';

export abstract class RbacRepository {
  abstract findAllModules(): Promise<PermissionModule[]>;
  abstract findAllPermissions(activeOnly?: boolean): Promise<PermissionDefinition[]>;
  abstract findPermissionCodes(codes: string[]): Promise<string[]>;

  abstract findAllRoles(shopId?: number): Promise<RoleDefinition[]>;
  abstract findRoleByCode(code: string): Promise<RoleDefinition | null>;
  abstract roleExists(code: string): Promise<boolean>;

  abstract findDirectRolePermissions(roleCode: string): Promise<RolePermissionGrant[]>;
  abstract findParentRoleCodes(roleCode: string): Promise<string[]>;
  abstract findActiveUserOverrides(userId: number, shopId: number): Promise<UserPermissionOverride[]>;

  abstract createShopRole(input: CreateShopRoleInput): Promise<RoleDefinition>;
  abstract updateShopRole(code: string, input: UpdateShopRoleInput): Promise<RoleDefinition>;
  abstract deleteShopRole(code: string): Promise<void>;
  abstract setRolePermissions(roleCode: string, grants: RolePermissionGrant[]): Promise<void>;
  abstract setRoleInheritance(childCode: string, parentCode: string): Promise<void>;
  abstract removeRoleInheritance(childCode: string, parentCode: string): Promise<void>;

  abstract createUserOverride(input: CreateOverrideInput): Promise<UserPermissionOverride>;
  abstract deactivateUserOverride(userId: number, shopId: number, permissionCode: string): Promise<void>;
  abstract deactivateAllUserOverrides(userId: number): Promise<void>;
  abstract updateOverridesShopForUser(userId: number, shopId: number): Promise<void>;
  abstract replaceUserOverrides(
    userId: number,
    shopId: number,
    overrides: CreateOverrideInput[],
  ): Promise<UserPermissionOverride[]>;
  abstract findUserOverrides(userId: number, shopId: number): Promise<UserPermissionOverride[]>;
}
