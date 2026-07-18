import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { ShopHierarchyService } from '../../../shops/domain/services/shop-hierarchy.service';
import { UserAccessPolicy } from '../../../users/domain/policies/user-access.policy';
import { IdentityRepository } from '../../domain/repositories/identity.repository';

@Injectable()
export class GetUserShopAccessUseCase {
  constructor(
    private readonly userAccess: UserAccessPolicy,
    private readonly shops: ShopRepository,
    private readonly hierarchy: ShopHierarchyService,
    private readonly identity: IdentityRepository,
  ) {}

  async execute(auth: AuthContext, targetUserId: number) {
    if (auth.role !== UserRole.OWNER) {
      throw new ForbiddenException('Réservé au patron.');
    }

    const target = await this.userAccess.assertAccessible(auth, targetUserId);
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('Les accès d\'un patron ne sont pas modifiables.');
    }

    const owned = await this.shops.findByOwnerUserId(auth.userId);
    const rootShopId = this.hierarchy.resolveRootShopId(owned, auth.shopId);
    const access = await this.identity.findUserShopAccess(target.id, rootShopId);
    if (!access) {
      throw new NotFoundException('Accès boutiques introuvable pour cet utilisateur.');
    }

    return {
      userId: access.userId,
      membershipId: access.membershipId,
      role: access.role,
      roleLabel: access.roleLabel,
      shops: access.grants.map((grant) => ({
        shopId: grant.shopId,
        shopName: grant.shopName,
        accessRole: grant.accessRole,
        effectiveRole: grant.effectiveRole,
        effectiveRoleLabel: grant.effectiveRoleLabel,
      })),
    };
  }
}
