import { ShopSettings } from '../entities/shop.entity';

export abstract class SettingsRepository {
  abstract findByShopId(shopId: number): Promise<ShopSettings | null>;
  abstract create(data: Record<string, unknown>): Promise<void>;
  abstract getDefault(shopId: number): ShopSettings;
}
