import { ConflictException, Injectable } from '@nestjs/common';
import { PermissionService } from '../../../../core/security/permission.service';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import {
  OwnerShopAssignmentDeniedException,
  SelfShopAssignmentDeniedException,
} from '../../../../shared/exceptions/rbac.exceptions';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { RbacRepository } from '../../../rbac/domain/repositories/rbac.repository';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { ShopOwnershipService } from '../../../shops/domain/services/shop-ownership.service';
import { ShopInactiveException } from '../../../shops/exceptions/shop.exceptions';
import { UserAccessPolicy } from '../../domain/policies/user-access.policy';
import { UserRepository } from '../../domain/repositories/user.repository';

@Injectable()
export class GetUserAssignmentUseCase {
  constructor(
    private readonly userAccess: UserAccessPolicy,
    private readonly shops: ShopRepository,
    private readonly permissionService: PermissionService,
    private readonly rbac: RbacRepository,
  ) {}

  async execute(auth: AuthContext, userId: number) {
    const user = await this.userAccess.assertAccessible(auth, userId);
    const shop = await this.shops.findShopById(user.shopId);

    const overrides = await this.rbac.findUserOverrides(user.id, user.shopId);

    return {
      id: user.id,
      name: user.name,
      shopId: user.shopId,
      shopName: shop?.name ?? 'Boutique',
      role: user.role,
      roleLabel: await this.permissionService.getRoleLabel(user.role),
      isActive: user.isActive,
      permissions: await this.permissionService.resolveForUser({
        userId: user.id,
        role: user.role,
        shopId: user.shopId,
      }),
      overrides: overrides
        .filter((o) => o.isActive)
        .map((o) => ({
          permissionCode: o.permissionCode,
          effect: o.effect,
          reason: o.reason,
          expiresAt: o.expiresAt,
        })),
    };
  }
}

@Injectable()
export class AssignUserShopUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly userAccess: UserAccessPolicy,
    private readonly shopOwnership: ShopOwnershipService,
    private readonly rbac: RbacRepository,
    private readonly permissionService: PermissionService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(
    auth: AuthContext,
    targetUserId: number,
    newShopId: number,
    reason?: string,
  ) {
    const target = await this.userAccess.assertAccessible(auth, targetUserId);

    if (target.id === auth.userId) {
      throw new SelfShopAssignmentDeniedException();
    }

    if (target.role === UserRole.OWNER) {
      throw new OwnerShopAssignmentDeniedException();
    }

    if (target.shopId === newShopId) {
      const shop = await this.shopOwnership.assertOwnerAccess(auth.userId, auth.role, newShopId);
      return {
        id: target.id,
        name: target.name,
        previousShopId: target.shopId,
        shopId: newShopId,
        shopName: shop.name,
      };
    }

    await this.shopOwnership.assertOwnerAccess(auth.userId, auth.role, target.shopId);
    const targetShop = await this.shopOwnership.assertOwnerAccess(auth.userId, auth.role, newShopId);
    if (!targetShop.isActive) {
      throw new ShopInactiveException();
    }

    const nameTaken = await this.users.existsByNameInShopExcluding(
      newShopId,
      target.name,
      target.id,
    );
    if (nameTaken) {
      throw new ConflictException(
        'Un utilisateur avec ce nom existe déjà dans la boutique cible.',
      );
    }

    const previousShopId = target.shopId;
    const timestamp = nowMs();

    await this.users.updateById(target.id, {
      shop_id: newShopId,
      updated_at: timestamp,
      version: target.version + 1,
    });

    await this.rbac.updateOverridesShopForUser(target.id, newShopId);

    this.permissionService.invalidateUserPermissions(target.id, previousShopId);
    this.permissionService.invalidateUserPermissions(target.id, newShopId);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.USER_SHOP_ASSIGNED,
      module: AuditModule.USERS,
      entityId: target.id,
      entityTable: 'users',
      oldValue: { shop_id: previousShopId },
      newValue: { shop_id: newShopId },
      reason: reason ?? 'Réaffectation boutique',
    });

    return {
      id: target.id,
      name: target.name,
      previousShopId,
      shopId: newShopId,
      shopName: targetShop.name,
    };
  }
}
