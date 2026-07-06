import { Injectable } from '@nestjs/common';
import { Shop } from '../entities/shop.entity';

/**
 * Réseau commercial : boutique racine + sous-boutiques créées depuis elle.
 * Indépendant du rattachement « même numéro / même patron ».
 */
@Injectable()
export class ShopHierarchyService {
  resolveRootShopId(shops: Shop[], contextShopId: number): number {
    const byId = new Map(shops.map((shop) => [shop.id, shop]));
    let current = byId.get(contextShopId);
    if (!current) return contextShopId;

    let depth = 0;
    while (current.parentShopId != null && depth < 10) {
      const parent = byId.get(current.parentShopId);
      if (!parent) break;
      current = parent;
      depth++;
    }

    return current.id;
  }

  shopsInGroup(shops: Shop[], contextShopId: number): Shop[] {
    const rootId = this.resolveRootShopId(shops, contextShopId);
    return shops.filter(
      (shop) =>
        shop.isActive &&
        (shop.id === rootId || shop.parentShopId === rootId),
    );
  }

  groupShopIds(shops: Shop[], contextShopId: number): number[] {
    const ids = this.shopsInGroup(shops, contextShopId).map((shop) => shop.id);
    return ids.length > 0 ? ids : [contextShopId];
  }
}
