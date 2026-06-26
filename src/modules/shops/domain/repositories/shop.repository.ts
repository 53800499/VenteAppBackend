import { Shop } from '../entities/shop.entity';

export interface UpdateShopData {
  name?: string;
  address?: string | null;
  phone?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  updated_at?: number;
}

export abstract class ShopRepository {
  abstract findShopById(shopId: number): Promise<Shop | null>;
  abstract findByOwnerUserId(ownerUserId: number): Promise<Shop[]>;
  abstract findOwnedById(shopId: number, ownerUserId: number): Promise<Shop | null>;
  abstract countActiveByOwner(ownerUserId: number): Promise<number>;
  abstract create(data: Record<string, unknown>): Promise<Shop>;
  abstract updateOwner(shopId: number, ownerUserId: number): Promise<void>;
  abstract updateInShop(shopId: number, data: UpdateShopData): Promise<Shop>;
  abstract clearDefaultForOwner(ownerUserId: number): Promise<void>;
  abstract findByNameIgnoreCase(name: string): Promise<Shop | null>;
}
