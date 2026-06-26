import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { throwSupabaseError } from '../../../../shared/utils/throw-supabase-error.util';
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
    if (error) throwSupabaseError(error);
    return data ? ShopMapper.settingsToDomain(data as SettingsRow) : null;
  }

  async create(data: Record<string, unknown>): Promise<void> {
    const shopId = Number(data.shop_id);
    if (!shopId) {
      throw new BadRequestException('shop_id requis pour créer les paramètres boutique.');
    }

    const existing = await this.findByShopId(shopId);
    if (existing) {
      await this.updateShopIdentity(shopId, {
        shop_name: data.shop_name as string | undefined,
        shop_phone: (data.shop_phone as string | null | undefined) ?? null,
        shop_address: (data.shop_address as string | null | undefined) ?? null,
        updated_at: data.updated_at as number,
      });
      return;
    }

    const { id: _ignored, ...payload } = data;
    const nextId = await this.nextSettingsId();
    const { error } = await this.supabase.db
      .from('settings')
      .insert({ ...payload, id: nextId });
    if (error) throwSupabaseError(error);
  }

  private async nextSettingsId(): Promise<number> {
    const { data, error } = await this.supabase.db
      .from('settings')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    if (error) throw new BadRequestException(error.message);
    const maxId = (data?.[0]?.id as number | undefined) ?? 0;
    return maxId + 1;
  }

  async updateShopIdentity(
    shopId: number,
    data: { shop_name?: string; shop_phone?: string | null; shop_address?: string | null; updated_at: number },
  ): Promise<void> {
    const { error } = await this.supabase.db.from('settings').update(data).eq('shop_id', shopId);
    if (error) throwSupabaseError(error);
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
