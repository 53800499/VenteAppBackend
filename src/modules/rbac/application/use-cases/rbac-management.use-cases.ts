import { Injectable } from '@nestjs/common';
import { PermissionService } from '../../../../core/security/permission.service';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import {
  OverrideNotFoundException,
  RoleCodeConflictException,
  RoleNotFoundException,
  SystemRoleProtectedException,
} from '../../../../shared/exceptions/rbac.exceptions';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { UserAccessPolicy } from '../../../users/domain/policies/user-access.policy';
import { RbacRepository } from '../../domain/repositories/rbac.repository';
import { RbacPermissionValidator } from '../../domain/services/rbac-permission.validator';
import {
  CreatePermissionOverrideDto,
  CreateShopRoleDto,
  ReplaceUserPermissionOverridesDto,
  SetRolePermissionsDto,
  UpdateShopRoleDto,
} from '../dto/rbac-management.dto';

@Injectable()
export class CreateShopRoleUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly validator: RbacPermissionValidator,
    private readonly permissionService: PermissionService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, input: CreateShopRoleDto) {
    const code = `shop_${auth.shopId}_${input.slug}`;
    if (await this.rbac.roleExists(code)) {
      throw new RoleCodeConflictException(code);
    }

    await this.validator.validateGrants(input.permissions);

    if (input.parentRoleCode) {
      const parent = await this.rbac.findRoleByCode(input.parentRoleCode);
      if (!parent) throw new RoleNotFoundException(input.parentRoleCode);
    }

    const role = await this.rbac.createShopRole({
      code,
      label: input.label,
      description: input.description,
      shopId: auth.shopId,
      parentRoleCode: input.parentRoleCode,
      permissions: input.permissions,
    });

    this.permissionService.invalidateRolePermissions(code);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: 'rbac_role_created',
      module: AuditModule.USERS,
      entityId: 0,
      entityTable: 'roles',
      newValue: { code: role.code, label: role.label },
      reason: 'Création rôle boutique',
    });

    return role;
  }
}

@Injectable()
export class UpdateShopRoleUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly validator: RbacPermissionValidator,
    private readonly permissionService: PermissionService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, roleCode: string, input: UpdateShopRoleDto) {
    const role = await this.assertShopRole(roleCode, auth.shopId);

    if (input.permissions) {
      await this.validator.validateGrants(input.permissions);
    }

    const updated = await this.rbac.updateShopRole(roleCode, input);
    this.permissionService.invalidateRolePermissions(roleCode);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: 'rbac_role_updated',
      module: AuditModule.USERS,
      entityId: 0,
      entityTable: 'roles',
      oldValue: { code: role.code },
      newValue: input as Record<string, unknown>,
      reason: 'Mise à jour rôle boutique',
    });

    return updated;
  }

  private async assertShopRole(roleCode: string, shopId: number) {
    const role = await this.rbac.findRoleByCode(roleCode);
    if (!role || role.scope !== 'shop' || role.shopId !== shopId) {
      throw new RoleNotFoundException(roleCode);
    }
    if (role.isSystem) throw new SystemRoleProtectedException(roleCode, 'modifié');
    return role;
  }
}

@Injectable()
export class DeleteShopRoleUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly permissionService: PermissionService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, roleCode: string) {
    const role = await this.rbac.findRoleByCode(roleCode);
    if (!role || role.scope !== 'shop' || role.shopId !== auth.shopId) {
      throw new RoleNotFoundException(roleCode);
    }
    if (role.isSystem) throw new SystemRoleProtectedException(roleCode, 'supprimé');

    await this.rbac.deleteShopRole(roleCode);
    this.permissionService.invalidateRolePermissions(roleCode);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: 'rbac_role_deleted',
      module: AuditModule.USERS,
      entityId: 0,
      entityTable: 'roles',
      oldValue: { code: role.code },
      reason: 'Suppression rôle boutique',
    });

    return { deleted: true, code: roleCode };
  }
}

@Injectable()
export class SetRolePermissionsUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly validator: RbacPermissionValidator,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(auth: AuthContext, roleCode: string, input: SetRolePermissionsDto) {
    const role = await this.rbac.findRoleByCode(roleCode);
    if (!role) throw new RoleNotFoundException(roleCode);
    if (role.scope === 'shop' && role.shopId !== auth.shopId) {
      throw new RoleNotFoundException(roleCode);
    }
    if (role.isSystem && role.scope === 'system') {
      throw new SystemRoleProtectedException(roleCode, 'modifié');
    }

    await this.validator.validateGrants(input.permissions);
    await this.rbac.setRolePermissions(roleCode, input.permissions);
    this.permissionService.invalidateRolePermissions(roleCode);

    return { code: roleCode, permissions: input.permissions };
  }
}

@Injectable()
export class ListUserOverridesUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly userAccess: UserAccessPolicy,
  ) {}

  async execute(auth: AuthContext, userId: number) {
    const user = await this.userAccess.assertAccessible(auth, userId);
    return this.rbac.findUserOverrides(userId, user.shopId);
  }
}

@Injectable()
export class CreateUserOverrideUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly userAccess: UserAccessPolicy,
    private readonly validator: RbacPermissionValidator,
    private readonly permissionService: PermissionService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, userId: number, input: CreatePermissionOverrideDto) {
    const user = await this.userAccess.assertAccessible(auth, userId);
    await this.validator.validateCode(input.permissionCode);

    const override = await this.rbac.createUserOverride({
      userId,
      shopId: user.shopId,
      permissionCode: input.permissionCode,
      effect: input.effect,
      reason: input.reason,
      grantedBy: auth.userId,
      expiresAt: input.expiresAt,
    });

    this.permissionService.invalidateUserPermissions(userId, user.shopId);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: 'rbac_override_created',
      module: AuditModule.USERS,
      entityId: userId,
      entityTable: 'user_permission_overrides',
      newValue: { permissionCode: input.permissionCode, effect: input.effect },
      reason: input.reason ?? 'Override permission',
    });

    return override;
  }
}

@Injectable()
export class RemoveUserOverrideUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly userAccess: UserAccessPolicy,
    private readonly permissionService: PermissionService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, userId: number, permissionCode: string) {
    const user = await this.userAccess.assertAccessible(auth, userId);

    const overrides = await this.rbac.findUserOverrides(userId, user.shopId);
    const exists = overrides.some((o) => o.permissionCode === permissionCode && o.isActive);
    if (!exists) throw new OverrideNotFoundException(userId, permissionCode);

    await this.rbac.deactivateUserOverride(userId, user.shopId, permissionCode);
    this.permissionService.invalidateUserPermissions(userId, user.shopId);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: 'rbac_override_removed',
      module: AuditModule.USERS,
      entityId: userId,
      entityTable: 'user_permission_overrides',
      oldValue: { permissionCode },
      reason: 'Suppression override',
    });

    return { removed: true, userId, permissionCode };
  }
}

@Injectable()
export class ReplaceUserOverridesUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly userAccess: UserAccessPolicy,
    private readonly validator: RbacPermissionValidator,
    private readonly permissionService: PermissionService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, userId: number, input: ReplaceUserPermissionOverridesDto) {
    const user = await this.userAccess.assertAccessible(auth, userId);

    for (const item of input.overrides) {
      await this.validator.validateCode(item.permissionCode);
    }

    const replaced = await this.rbac.replaceUserOverrides(
      userId,
      user.shopId,
      input.overrides.map((item) => ({
        userId,
        shopId: user.shopId,
        permissionCode: item.permissionCode,
        effect: item.effect,
        reason: item.reason,
        grantedBy: auth.userId,
        expiresAt: item.expiresAt,
      })),
    );

    this.permissionService.invalidateUserPermissions(userId, user.shopId);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.RBAC_OVERRIDES_REPLACED,
      module: AuditModule.USERS,
      entityId: userId,
      entityTable: 'user_permission_overrides',
      newValue: {
        count: replaced.length,
        permissions: replaced.map((o) => o.permissionCode),
      },
      reason: input.reason ?? 'Remplacement des overrides utilisateur',
    });

    return {
      userId,
      overrides: replaced.map((o) => ({
        permissionCode: o.permissionCode,
        effect: o.effect,
        reason: o.reason,
        expiresAt: o.expiresAt,
      })),
      permissions: await this.permissionService.resolveForUser({
        userId: user.id,
        role: user.role,
        shopId: user.shopId,
      }),
    };
  }
}

@Injectable()
export class GetUserEffectivePermissionsUseCase {
  constructor(
    private readonly userAccess: UserAccessPolicy,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(auth: AuthContext, userId: number) {
    const user = await this.userAccess.assertAccessible(auth, userId);

    return {
      userId: user.id,
      role: user.role,
      roleLabel: await this.permissionService.getRoleLabel(user.role),
      shopId: user.shopId,
      permissions: await this.permissionService.resolveForUser({
        userId: user.id,
        role: user.role,
        shopId: user.shopId,
      }),
    };
  }
}
