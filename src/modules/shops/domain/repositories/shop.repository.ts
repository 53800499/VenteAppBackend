import { Shop } from '../entities/shop.entity';

export abstract class ShopRepository {
  abstract findShopById(shopId: number): Promise<Shop | null>;
  abstract create(data: Record<string, unknown>): Promise<Shop>;
  abstract updateOwner(shopId: number, ownerUserId: number): Promise<void>;
}
