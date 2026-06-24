import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinHasherService } from '../../../../core/security/pin-hasher.service';
import { PermissionService } from '../../../../core/security/permission.service';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import {
  LastOwnerProtectionException,
  SelfAccountDeactivationException,
} from '../../../../shared/exceptions/rbac.exceptions';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { Pin } from '../../../auth/domain/value-objects/pin.vo';
import { RoleChangePolicy } from '../../../rbac/domain/policies/role-change.policy';
import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/repositories/user.repository';

@Injectable()
export class ListShopUsersUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(auth: AuthContext) {
    const rows = await this.users.findAllByShop(auth.shopId);
    return Promise.all(rows.map((user) => this.toDto(user)));
  }

  private async toDto(user: User) {
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      roleLabel: await this.permissionService.getRoleLabel(user.role),
      isActive: user.isActive,
      biometricEnabled: user.biometricEnabled,
      lastLoginAt: user.lastLoginAt,
      permissions: await this.permissionService.resolveForUser({
        userId: user.id,
        role: user.role,
        shopId: user.shopId,
      }),
    };
  }
}

@Injectable()
export class CreateShopUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly pinHasher: PinHasherService,
  ) {}

  async execute(
    auth: AuthContext,
    input: { name: string; pin: string; role: UserRole.SELLER | UserRole.VIEWER },
  ) {
    const exists = await this.users.existsByNameInShop(auth.shopId, input.name);
    if (exists) {
      throw new ConflictException('Un utilisateur avec ce nom existe déjà dans la boutique.');
    }

    const pin = Pin.create(input.pin);
    const pinHash = await this.pinHasher.hash(pin.value);
    const timestamp = nowMs();

    const user = await this.users.create({
      shop_id: auth.shopId,
      name: input.name,
      pin_hash: pinHash,
      role: input.role,
      created_at: timestamp,
      updated_at: timestamp,
    });

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      shopId: user.shopId,
    };
  }
}

@Injectable()
export class ChangeUserRoleUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly logAudit: LogAuditUseCase,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(
    auth: AuthContext,
    targetUserId: number,
    newRole: UserRole,
    reason?: string,
  ) {
    const target = await this.users.findByIdAndShop(targetUserId, auth.shopId);
    if (!target) {
      throw new NotFoundException('Utilisateur introuvable dans cette boutique.');
    }

    const ownerCount = await this.users.countOwnersByShop(auth.shopId);
    RoleChangePolicy.validate({
      actorUserId: auth.userId,
      target,
      newRole,
      ownerCount,
    });

    const timestamp = nowMs();
    await this.users.updateInShop(target.id, auth.shopId, {
      role: newRole,
      updated_at: timestamp,
      version: target.version + 1,
    });

    this.permissionService.invalidateUserPermissions(target.id, auth.shopId);
    this.permissionService.invalidateRolePermissions(newRole);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.USER_ROLE_CHANGED,
      module: AuditModule.USERS,
      entityId: target.id,
      entityTable: 'users',
      oldValue: { role: target.role },
      newValue: { role: newRole },
      reason: reason ?? 'Changement de rôle',
    });

    return {
      id: target.id,
      name: target.name,
      previousRole: target.role,
      role: newRole,
      roleLabel: await this.permissionService.getRoleLabel(newRole),
      permissions: await this.permissionService.resolveForUser({
        userId: target.id,
        role: newRole,
        shopId: auth.shopId,
      }),
    };
  }
}

@Injectable()
export class DeactivateShopUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, targetUserId: number, reason?: string) {
    const target = await this.users.findByIdAndShop(targetUserId, auth.shopId);
    if (!target) {
      throw new NotFoundException('Utilisateur introuvable dans cette boutique.');
    }

    if (target.id === auth.userId) {
      throw new SelfAccountDeactivationException();
    }

    if (target.role === UserRole.OWNER) {
      const ownerCount = await this.users.countOwnersByShop(auth.shopId);
      if (ownerCount <= 1) {
        throw new LastOwnerProtectionException('deactivate');
      }
    }

    const timestamp = nowMs();
    await this.users.updateInShop(target.id, auth.shopId, {
      is_active: false,
      updated_at: timestamp,
      version: target.version + 1,
    });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: 'user_deactivated',
      module: AuditModule.USERS,
      entityId: target.id,
      entityTable: 'users',
      oldValue: { is_active: true, role: target.role },
      newValue: { is_active: false },
      reason: reason ?? 'Désactivation utilisateur',
    });

    return { id: target.id, deactivated: true };
  }
}
