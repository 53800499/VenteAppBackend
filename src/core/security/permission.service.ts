import { Injectable } from '@nestjs/common';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '../../shared/constants/role-permissions.map';
import { Permission } from '../../shared/enums/permission.enum';
import { UserRole } from '../../shared/enums/user-role.enum';
import { EffectivePermissionResolver } from '../../modules/rbac/domain/services/effective-permission.resolver';
import { RbacRepository } from '../../modules/rbac/domain/repositories/rbac.repository';

export interface ResolveUserPermissionsInput {
  userId: number;
  role: UserRole;
  shopId: number;
}

@Injectable()
export class PermissionService {
  constructor(
    private readonly resolver: EffectivePermissionResolver,
    private readonly rbac: RbacRepository,
  ) {}

  async resolveForUser(input: ResolveUserPermissionsInput): Promise<Permission[]> {
    return this.resolver.resolve(input);
  }

  getPermissionsForRole(role: UserRole): Permission[] {
    return [...ROLE_PERMISSIONS[role]];
  }

  async getRoleLabel(role: UserRole | string): Promise<string> {
    try {
      const definition = await this.rbac.findRoleByCode(role);
      if (definition) return definition.label;
    } catch {
      // fallback
    }
    return ROLE_LABELS[role as UserRole] ?? role;
  }

  getRoleLabelSync(role: UserRole): string {
    return ROLE_LABELS[role];
  }

  async hasPermissionForUser(
    input: ResolveUserPermissionsInput,
    permission: Permission,
  ): Promise<boolean> {
    const perms = await this.resolveForUser(input);
    return perms.includes(permission);
  }

  hasPermission(role: UserRole, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role].includes(permission);
  }

  hasEveryPermission(role: UserRole, permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(role, p));
  }

  hasSomePermission(role: UserRole, permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(role, p));
  }

  getAllRoles(): UserRole[] {
    return Object.values(UserRole);
  }

  getAllPermissions(): Permission[] {
    return Object.values(Permission);
  }

  invalidateUserPermissions(userId: number, shopId: number): void {
    this.resolver.invalidateUser(userId, shopId);
  }

  invalidateRolePermissions(role: string): void {
    this.resolver.invalidateRole(role);
  }
}
