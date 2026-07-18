import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { ShopHierarchyService } from '../../../shops/domain/services/shop-hierarchy.service';
import { ShopOwnershipService } from '../../../shops/domain/services/shop-ownership.service';
import { UserAccessPolicy } from '../../../users/domain/policies/user-access.policy';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { ShopAccessGrant } from '../../domain/entities/identity.entity';
import { IdentityRepository } from '../../domain/repositories/identity.repository';
import { IdentityProvisioningService } from '../../domain/services/identity-provisioning.service';

@Injectable()
export class SyncUserShopAccessUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly shops: ShopRepository,
    private readonly userAccess: UserAccessPolicy,
    private readonly shopOwnership: ShopOwnershipService,
    private readonly hierarchy: ShopHierarchyService,
    private readonly identity: IdentityRepository,
    private readonly identityProvisioning: IdentityProvisioningService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(
    auth: AuthContext,
    targetUserId: number,
    grants: ShopAccessGrant[],
  ) {
    if (auth.role !== UserRole.OWNER) {
      throw new ForbiddenException('Réservé au patron.');
    }

    const target = await this.userAccess.assertAccessible(auth, targetUserId);
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('Impossible de modifier les accès d\'un patron.');
    }

    if (grants.length === 0) {
      throw new ConflictException('Au moins une boutique doit être autorisée.');
    }

    const owned = await this.shops.findByOwnerUserId(auth.userId);
    const rootShopId = this.hierarchy.resolveRootShopId(owned, auth.shopId);
    const orgFromRepo = await this.resolveOrganizationId(rootShopId);
    for (const grant of grants) {
      await this.shopOwnership.assertOwnerAccess(auth.userId, auth.role, grant.shopId);
    }

    const membershipId = await this.identity.findMembershipForUserInOrganization(
      target.id,
      orgFromRepo,
    );
    if (membershipId == null) {
      throw new NotFoundException('Membership introuvable pour cet utilisateur.');
    }

    await this.identityProvisioning.replaceStaffShopAccess(membershipId, grants);

    const primaryShopId = grants[0].shopId;
    if (target.shopId !== primaryShopId) {
      await this.users.updateById(target.id, {
        shop_id: primaryShopId,
        updated_at: nowMs(),
        version: target.version + 1,
      });
    }

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.USER_SHOP_ASSIGNED,
      module: AuditModule.USERS,
      entityId: target.id,
      entityTable: 'users',
      newValue: { shop_access: grants },
      reason: 'Mise à jour des accès multi-boutiques',
    });

    return {
      userId: target.id,
      membershipId,
      shops: grants,
    };
  }

  private async resolveOrganizationId(rootShopId: number) {
    const rootShop = await this.shops.findShopById(rootShopId);
    if (!rootShop) {
      throw new NotFoundException('Boutique racine introuvable.');
    }
    return this.identity.ensureOwnerOrganization(
      rootShop.ownerUserId ?? 0,
      rootShopId,
      rootShop.name,
    );
  }
}
