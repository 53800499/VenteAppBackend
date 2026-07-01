import { Shop, ShopSettings } from '../../domain/entities/shop.entity';
import { ShopConfiguration } from '../../domain/entities/shop-configuration.entity';
import { SettingsRow, ShopRow } from '../persistence/shop.row';

export class ShopMapper {
  static toDomain(row: ShopRow): Shop {
    return new Shop(
      row.id,
      row.name,
      row.address,
      row.phone,
      row.owner_user_id,
      row.is_active,
      row.is_default,
      row.created_at,
    );
  }

  static settingsToDomain(row: SettingsRow): ShopSettings {
    return new ShopSettings(
      row.id,
      row.shop_id,
      row.shop_name,
      row.shop_logo_path,
      row.auto_lock_minutes,
    );
  }

  static configurationToDomain(row: SettingsRow): ShopConfiguration {
    return new ShopConfiguration(
      row.id,
      row.shop_id,
      row.shop_name,
      row.shop_phone ?? null,
      row.shop_address ?? null,
      row.shop_logo_path,
      row.currency ?? 'FCFA',
      row.language ?? 'fr',
      row.default_alert_threshold ?? 5,
      row.auto_lock_minutes,
      row.receipt_footer ?? null,
      row.backup_last_at ?? null,
      row.backup_path ?? null,
      row.cloud_sync_enabled ?? false,
      row.cloud_last_sync_at ?? null,
      row.updated_at ?? Date.now(),
    );
  }
}
