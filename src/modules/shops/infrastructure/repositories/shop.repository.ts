import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { Shop } from '../../domain/entities/shop.entity';
import { ShopRepository } from '../../domain/repositories/shop.repository';
import { ShopMapper } from '../mappers/shop.mapper';
import { ShopRow } from '../persistence/shop.row';

@Injectable()
export class SupabaseShopRepository extends ShopRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findShopById(shopId: number): Promise<Shop | null> {
    const { data, error } = await this.supabase.db
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? ShopMapper.toDomain(data as ShopRow) : null;
  }

  async create(data: Record<string, unknown>): Promise<Shop> {
    const { data: row, error } = await this.supabase.db
      .from('shops')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Création boutique impossible.');
    }
    return ShopMapper.toDomain(row as ShopRow);
  }

  async updateOwner(shopId: number, ownerUserId: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('shops')
      .update({ owner_user_id: ownerUserId })
      .eq('id', shopId);
    if (error) throw new NotFoundException(error.message);
  }
}
