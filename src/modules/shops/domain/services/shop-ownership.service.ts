import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { Shop } from '../entities/shop.entity';
import { ShopRepository } from '../repositories/shop.repository';
import { ShopHierarchyService } from './shop-hierarchy.service';
import { ShopInactiveException } from '../../exceptions/shop.exceptions';

import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { IdentityRepository } from '../../../identity/domain/repositories/identity.repository';

@Injectable()
export class ShopOwnershipService {
  constructor(
    private readonly shops: ShopRepository,
    private readonly users: UserRepository,
    private readonly hierarchy: ShopHierarchyService,
    private readonly identity: IdentityRepository,
  ) {}

  async assertOwnerAccess(userId: number, role: string, shopId: number): Promise<Shop> {
    if (role !== UserRole.OWNER) {
      throw new ForbiddenException('Réservé au patron.');
    }
    const shop = await this.shops.findOwnedById(shopId, userId);
    if (!shop) {
      throw new NotFoundException('Boutique introuvable ou accès refusé.');
    }
    return shop;
  }

  async resolveUserForShop(userId: number, shopId: number) {
    const direct = await this.users.findByIdAndShop(userId, shopId);
    if (direct) return direct;

    const shop = await this.shops.findOwnedById(shopId, userId);
    if (!shop) return null;

    return this.users.findById(userId);
  }

  /**
   * Boutique active pour la requête : header X-Shop-Id ou boutique par défaut de la session.
   * Patron : toute boutique possédée. Vendeur/lecteur : uniquement sa boutique d'affectation.
   */
  async resolveActiveShop(
    userId: number,
    role: string,
    homeShopId: number,
    sessionDefaultShopId: number,
    requestedShopId?: number,
  ): Promise<number> {
    const target = requestedShopId ?? sessionDefaultShopId;

    if (role === UserRole.OWNER) {
      const owned = await this.shops.findByOwnerUserId(userId);
      const inGroup = this.hierarchy.shopsInGroup(owned, sessionDefaultShopId);
      const shop = inGroup.find((candidate) => candidate.id === target);
      if (!shop) {
        throw new NotFoundException('Boutique introuvable ou accès refusé.');
      }
      if (!shop.isActive) {
        throw new ShopInactiveException();
      }
      return target;
    }

    const hasAccess = await this.identity.userHasShopAccess(userId, target);
    if (hasAccess) {
      const shop = await this.shops.findShopById(target);
      if (!shop?.isActive) {
        throw new ShopInactiveException();
      }
      return target;
    }

    if (target !== homeShopId) {
      throw new ForbiddenException('Cette boutique ne vous est pas associée.');
    }
    return homeShopId;
  }
}
