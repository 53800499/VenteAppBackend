import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { throwSupabaseError } from '../../../../shared/utils/throw-supabase-error.util';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { Shop } from '../../domain/entities/shop.entity';
import {
  ShopRepository,
  UpdateShopData,
} from '../../domain/repositories/shop.repository';
import { ShopMapper } from '../mappers/shop.mapper';
import { ShopRow } from '../persistence/shop.row';

@Injectable()
export class SupabaseShopRepository extends ShopRepository {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly tenantDb: TenantDatabaseService,
  ) {
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

  async findByOwnerUserId(ownerUserId: number): Promise<Shop[]> {
    return this.tenantDb.runWithoutTenant(async () => {
      const { data, error } = await this.supabase.db
        .from('shops')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw new BadRequestException(error.message);
      return (data ?? []).map((row) => ShopMapper.toDomain(row as ShopRow));
    });
  }

  async findOwnedById(shopId: number, ownerUserId: number): Promise<Shop | null> {
    return this.tenantDb.runWithoutTenant(async () => {
      const { data, error } = await this.supabase.db
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .eq('owner_user_id', ownerUserId)
        .maybeSingle();
      if (error) throw new BadRequestException(error.message);
      return data ? ShopMapper.toDomain(data as ShopRow) : null;
    });
  }

  async countActiveByOwner(ownerUserId: number): Promise<number> {
    return this.tenantDb.runWithoutTenant(async () => {
      const { count, error } = await this.supabase.db
        .from('shops')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', ownerUserId)
        .eq('is_active', true);
      if (error) throw new BadRequestException(error.message);
      return count ?? 0;
    });
  }

  async create(data: Record<string, unknown>): Promise<Shop> {
    return this.tenantDb.runWithoutTenant(async () => {
      const { data: row, error } = await this.supabase.db
        .from('shops')
        .insert(data)
        .select('*')
        .single();
      if (error || !row) {
        if (error) throwSupabaseError(error);
        throw new BadRequestException('Création boutique impossible.');
      }
      return ShopMapper.toDomain(row as ShopRow);
    });
  }

  async updateOwner(shopId: number, ownerUserId: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('shops')
      .update({ owner_user_id: ownerUserId })
      .eq('id', shopId);
    if (error) throw new NotFoundException(error.message);
  }

  async updateInShop(shopId: number, data: UpdateShopData): Promise<Shop> {
    const { data: row, error } = await this.supabase.db
      .from('shops')
      .update(data)
      .eq('id', shopId)
      .select('*')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!row) throw new NotFoundException('Boutique introuvable.');
    return ShopMapper.toDomain(row as ShopRow);
  }

  async clearDefaultForOwner(ownerUserId: number): Promise<void> {
    await this.tenantDb.runWithoutTenant(async () => {
      const { error } = await this.supabase.db
        .from('shops')
        .update({ is_default: false })
        .eq('owner_user_id', ownerUserId);
      if (error) throw new BadRequestException(error.message);
    });
  }

  async findByNameIgnoreCase(name: string): Promise<Shop | null> {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return null;

    return this.tenantDb.runWithoutTenant(async () => {
      const { data, error } = await this.supabase.db.from('shops').select('*');
      if (error) throw new BadRequestException(error.message);

      const row = (data ?? []).find(
        (shop) => (shop.name as string).trim().toLowerCase() === normalized,
      );
      return row ? ShopMapper.toDomain(row as ShopRow) : null;
    });
  }
}
