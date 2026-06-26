import { ShopSettings } from '../entities/shop.entity';

export abstract class SettingsRepository {
  abstract findByShopId(shopId: number): Promise<ShopSettings | null>;
  abstract create(data: Record<string, unknown>): Promise<void>;
  abstract updateShopIdentity(
    shopId: number,
    data: { shop_name?: string; shop_phone?: string | null; shop_address?: string | null; updated_at: number },
  ): Promise<void>;
  abstract getDefault(shopId: number): ShopSettings;
}
