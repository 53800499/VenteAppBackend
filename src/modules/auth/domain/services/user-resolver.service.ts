import { Injectable, NotFoundException } from '@nestjs/common';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { ShopOwnershipService } from '../../../shops/domain/services/shop-ownership.service';
import { User } from '../../../users/domain/entities/user.entity';
import { UserRepository } from '../../../users/domain/repositories/user.repository';

@Injectable()
export class UserResolverService {
  constructor(
    private readonly users: UserRepository,
    private readonly shops: ShopRepository,
    private readonly ownership: ShopOwnershipService,
  ) {}

  async resolve(shopId: number, userId?: number): Promise<User> {
    if (userId) {
      const direct = await this.users.findByIdAndShop(userId, shopId);
      if (direct) return direct;

      const viaOwnership = await this.ownership.resolveUserForShop(userId, shopId);
      if (viaOwnership) return viaOwnership;

      throw new NotFoundException(`Utilisateur ${userId} introuvable dans cette boutique.`);
    }

    const inShop = await this.users.findFirstActiveByShop(shopId);
    if (inShop) return inShop;

    const owner = await this.resolveShopOwnerUser(shopId);
    if (owner) return owner;

    throw new NotFoundException('Aucun utilisateur trouvé pour cette boutique.');
  }

  private async resolveShopOwnerUser(shopId: number): Promise<User | null> {
    const shop = await this.shops.findShopById(shopId);
    if (!shop) return null;

    if (shop.ownerUserId) {
      const owner = await this.users.findById(shop.ownerUserId);
      if (owner?.isActive) return owner;
    }

    if (shop.parentShopId) {
      return this.resolveShopOwnerUser(shop.parentShopId);
    }

    return null;
  }
}
