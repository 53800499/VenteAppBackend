import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { ShopSettings } from '../../domain/entities/shop.entity';
import { SettingsRepository } from '../../domain/repositories/settings.repository';
import { ShopMapper } from '../mappers/shop.mapper';
import { SettingsRow } from '../persistence/shop.row';

@Injectable()
export class SupabaseSettingsRepository extends SettingsRepository {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async findByShopId(shopId: number): Promise<ShopSettings | null> {
    const { data, error } = await this.supabase.db
      .from('settings')
      .select('id, shop_id, shop_name, shop_logo_path, auto_lock_minutes')
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? ShopMapper.settingsToDomain(data as SettingsRow) : null;
  }

  async create(data: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.db.from('settings').insert(data);
    if (error) throw new BadRequestException(error.message);
  }

  async updateShopIdentity(
    shopId: number,
    data: { shop_name?: string; shop_phone?: string | null; shop_address?: string | null; updated_at: number },
  ): Promise<void> {
    const { error } = await this.supabase.db.from('settings').update(data).eq('shop_id', shopId);
    if (error) throw new BadRequestException(error.message);
  }

  getDefault(shopId: number): ShopSettings {
    return new ShopSettings(
      1,
      shopId,
      'Ma Boutique',
      null,
      this.configService.get<number>('auth.defaultAutoLockMinutes', 5),
    );
  }
}
