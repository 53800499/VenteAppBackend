import { ShopSettings } from '../entities/shop.entity';
import { ShopConfiguration } from '../entities/shop-configuration.entity';

export interface UpdateShopConfigurationData {
  shop_name?: string;
  shop_phone?: string | null;
  shop_address?: string | null;
  shop_logo_path?: string | null;
  default_alert_threshold?: number;
  auto_lock_minutes?: number;
  receipt_footer?: string | null;
  updated_at: number;
}

export interface RecordBackupData {
  backup_last_at: number;
  backup_path?: string | null;
  updated_at: number;
}

export interface UpdateSyncSettingsData {
  cloud_sync_enabled?: boolean;
  cloud_last_sync_at?: number;
  updated_at: number;
}

export abstract class SettingsRepository {
  abstract findByShopId(shopId: number): Promise<ShopSettings | null>;
  abstract findConfigurationByShopId(shopId: number): Promise<ShopConfiguration | null>;
  abstract create(data: Record<string, unknown>): Promise<void>;
  abstract updateShopIdentity(
    shopId: number,
    data: { shop_name?: string; shop_phone?: string | null; shop_address?: string | null; updated_at: number },
  ): Promise<void>;
  abstract updateConfiguration(shopId: number, data: UpdateShopConfigurationData): Promise<ShopConfiguration>;
  abstract recordBackup(shopId: number, data: RecordBackupData): Promise<ShopConfiguration>;
  abstract updateSyncSettings(shopId: number, data: UpdateSyncSettingsData): Promise<ShopConfiguration>;
  abstract getDefault(shopId: number): ShopSettings;
}
