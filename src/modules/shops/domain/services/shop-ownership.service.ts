import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { Shop } from '../entities/shop.entity';
import { ShopRepository } from '../repositories/shop.repository';
import { ShopInactiveException } from '../../exceptions/shop.exceptions';

import { UserRepository } from '../../../users/domain/repositories/user.repository';

@Injectable()
export class ShopOwnershipService {
  constructor(
    private readonly shops: ShopRepository,
    private readonly users: UserRepository,
  ) {}

  async assertOwnerAccess(userId: number, role: UserRole, shopId: number): Promise<Shop> {
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
    role: UserRole,
    homeShopId: number,
    sessionDefaultShopId: number,
    requestedShopId?: number,
  ): Promise<number> {
    const target = requestedShopId ?? sessionDefaultShopId;

    if (role === UserRole.OWNER) {
      const shop = await this.shops.findOwnedById(target, userId);
      if (!shop) {
        throw new NotFoundException('Boutique introuvable ou accès refusé.');
      }
      if (!shop.isActive) {
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
