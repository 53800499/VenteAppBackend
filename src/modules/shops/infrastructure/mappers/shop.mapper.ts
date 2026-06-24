import { Shop, ShopSettings } from '../../domain/entities/shop.entity';
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
}
