import {
  PermissionDefinition,
  PermissionModule,
  RoleDefinition,
  RolePermissionGrant,
  UserPermissionOverride,
} from '../../domain/entities/rbac.entity';
import {
  PermissionModuleRow,
  PermissionRow,
  RolePermissionRow,
  RoleRow,
  UserPermissionOverrideRow,
} from '../persistence/rbac.row';

export class RbacMapper {
  static toModule(row: PermissionModuleRow): PermissionModule {
    return {
      code: row.code,
      label: row.label,
      description: row.description,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    };
  }

  static toPermission(row: PermissionRow): PermissionDefinition {
    return {
      code: row.code,
      moduleCode: row.module_code,
      action: row.action,
      label: row.label,
      description: row.description,
      isActive: row.is_active,
      isSystem: row.is_system,
      sortOrder: row.sort_order,
    };
  }

  static toRole(row: RoleRow): RoleDefinition {
    return {
      code: row.code,
      label: row.label,
      description: row.description,
      scope: row.scope,
      shopId: row.shop_id,
      priority: row.priority,
      isActive: row.is_active,
      isSystem: row.is_system,
    };
  }

  static toGrant(row: RolePermissionRow): RolePermissionGrant {
    return {
      permissionCode: row.permission_code,
      effect: row.effect,
    };
  }

  static toOverride(row: UserPermissionOverrideRow): UserPermissionOverride {
    return {
      id: row.id,
      userId: row.user_id,
      shopId: row.shop_id,
      permissionCode: row.permission_code,
      effect: row.effect,
      reason: row.reason,
      grantedBy: row.granted_by,
      expiresAt: row.expires_at,
      isActive: row.is_active,
    };
  }
}
