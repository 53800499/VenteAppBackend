import { Injectable, NotFoundException } from '@nestjs/common';
import { Shop } from '../entities/shop.entity';
import { ShopRepository } from '../repositories/shop.repository';

@Injectable()
export class ShopHierarchyService {
  constructor(private readonly shops: ShopRepository) {}

  async resolveRootShopId(shopId: number): Promise<number> {
    let current = await this.shops.findShopById(shopId);
    if (!current) {
      throw new NotFoundException('Boutique introuvable.');
    }

    const visited = new Set<number>();
    while (current.parentShopId != null) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      const parent = await this.shops.findShopById(current.parentShopId);
      if (!parent) break;
      current = parent;
    }

    return current.id;
  }

  belongsToTree(shop: Shop, rootShopId: number): boolean {
    return shop.id === rootShopId || shop.parentShopId === rootShopId;
  }

  filterShopsInTree(shops: Shop[], rootShopId: number): Shop[] {
    return shops.filter((shop) => this.belongsToTree(shop, rootShopId));
  }

  async resolveActiveTreeShopIds(
    contextShopId: number,
    ownerUserId: number,
  ): Promise<number[]> {
    const rootShopId = await this.resolveRootShopId(contextShopId);
    const owned = await this.shops.findByOwnerUserId(ownerUserId);
    const activeIds = this.filterShopsInTree(owned, rootShopId)
      .filter((shop) => shop.isActive)
      .map((shop) => shop.id);
    return activeIds.length > 0 ? activeIds : [contextShopId];
  }
}
