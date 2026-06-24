import { Injectable, NotFoundException } from '@nestjs/common';
import { PermissionService } from '../../../../core/security/permission.service';
import { AuditModule } from '../../../../shared/enums/audit.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import {
  OverrideNotFoundException,
  RoleCodeConflictException,
  RoleNotFoundException,
  SystemRoleProtectedException,
} from '../../../../shared/exceptions/rbac.exceptions';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { RbacRepository } from '../../domain/repositories/rbac.repository';
import { RbacPermissionValidator } from '../../domain/services/rbac-permission.validator';
import {
  CreatePermissionOverrideDto,
  CreateShopRoleDto,
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
  constructor(private readonly rbac: RbacRepository, private readonly users: UserRepository) {}

  async execute(auth: AuthContext, userId: number) {
    await this.assertUserInShop(auth, userId);
    return this.rbac.findUserOverrides(userId, auth.shopId);
  }

  private async assertUserInShop(auth: AuthContext, userId: number) {
    const user = await this.users.findByIdAndShop(userId, auth.shopId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable dans cette boutique.');
    }
  }
}

@Injectable()
export class CreateUserOverrideUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly users: UserRepository,
    private readonly validator: RbacPermissionValidator,
    private readonly permissionService: PermissionService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, userId: number, input: CreatePermissionOverrideDto) {
    await this.assertUserInShop(auth, userId);
    await this.validator.validateCode(input.permissionCode);

    const override = await this.rbac.createUserOverride({
      userId,
      shopId: auth.shopId,
      permissionCode: input.permissionCode,
      effect: input.effect,
      reason: input.reason,
      grantedBy: auth.userId,
      expiresAt: input.expiresAt,
    });

    this.permissionService.invalidateUserPermissions(userId, auth.shopId);

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

  private async assertUserInShop(auth: AuthContext, userId: number) {
    const user = await this.users.findByIdAndShop(userId, auth.shopId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable dans cette boutique.');
    }
  }
}

@Injectable()
export class RemoveUserOverrideUseCase {
  constructor(
    private readonly rbac: RbacRepository,
    private readonly users: UserRepository,
    private readonly permissionService: PermissionService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, userId: number, permissionCode: string) {
    await this.assertUserInShop(auth, userId);

    const overrides = await this.rbac.findUserOverrides(userId, auth.shopId);
    const exists = overrides.some((o) => o.permissionCode === permissionCode && o.isActive);
    if (!exists) throw new OverrideNotFoundException(userId, permissionCode);

    await this.rbac.deactivateUserOverride(userId, auth.shopId, permissionCode);
    this.permissionService.invalidateUserPermissions(userId, auth.shopId);

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

  private async assertUserInShop(auth: AuthContext, userId: number) {
    const user = await this.users.findByIdAndShop(userId, auth.shopId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable dans cette boutique.');
    }
  }
}
