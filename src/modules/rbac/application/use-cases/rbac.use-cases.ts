import { Injectable } from '@nestjs/common';
import { PermissionService } from '../../../../core/security/permission.service';
import { Permission } from '../../../../shared/enums/permission.enum';
import { RoleNotFoundException } from '../../../../shared/exceptions/rbac.exceptions';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { RbacRepository } from '../../domain/repositories/rbac.repository';

@Injectable()
export class GetRolesCatalogUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(shopId?: number) {
    const roles = await this.rbac.findAllRoles(shopId);
    const result = await Promise.all(
      roles.map(async (role) => {
        const grants = await this.rbac.findDirectRolePermissions(role.code);
        const parents = await this.rbac.findParentRoleCodes(role.code);
        return {
          code: role.code,
          label: role.label,
          description: role.description,
          scope: role.scope,
          shopId: role.shopId,
          isSystem: role.isSystem,
          priority: role.priority,
          parentRoles: parents,
          permissions: grants,
        };
      }),
    );
    return result;
  }
}

@Injectable()
export class GetPermissionsCatalogUseCase {
  constructor(private readonly rbac: RbacRepository) {}

  async execute() {
    const [modules, permissions] = await Promise.all([
      this.rbac.findAllModules(),
      this.rbac.findAllPermissions(),
    ]);

    return {
      modules,
      permissions: permissions.map((p) => ({
        code: p.code,
        module: p.moduleCode,
        action: p.action,
        label: p.label,
        description: p.description,
      })),
    };
  }
}

@Injectable()
export class GetMyPermissionsUseCase {
  constructor(private readonly permissionService: PermissionService) {}

  async execute(auth: AuthContext) {
    return {
      userId: auth.userId,
      shopId: auth.shopId,
      role: auth.role,
      roleLabel: await this.permissionService.getRoleLabel(auth.role),
      permissions: auth.permissions,
    };
  }
}

@Injectable()
export class CheckPermissionUseCase {
  constructor(private readonly permissionService: PermissionService) {}

  async execute(auth: AuthContext, permission: Permission) {
    const granted = auth.permissions.includes(permission);
    return {
      permission,
      granted,
      role: auth.role,
    };
  }
}

@Injectable()
export class GetRoleDetailUseCase {
  constructor(private readonly rbac: RbacRepository) {}

  async execute(roleCode: string, shopId: number) {
    const role = await this.rbac.findRoleByCode(roleCode);
    if (!role) {
      throw new RoleNotFoundException(roleCode);
    }
    if (role.scope === 'shop' && role.shopId !== shopId) {
      throw new RoleNotFoundException(roleCode);
    }

    const [grants, parents] = await Promise.all([
      this.rbac.findDirectRolePermissions(role.code),
      this.rbac.findParentRoleCodes(role.code),
    ]);

    return { ...role, parentRoles: parents, permissions: grants };
  }
}
