import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { throwSupabaseError } from '../../../../shared/utils/throw-supabase-error.util';
import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserMapper } from '../mappers/user.mapper';
import { UserRow } from '../persistence/user.row';

@Injectable()
export class SupabaseUserRepository extends UserRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async countAll(): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('users')
      .select('id', { count: 'exact', head: true });
    if (error) throw new BadRequestException(error.message);
    return count ?? 0;
  }

  async findById(id: number): Promise<User | null> {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? UserMapper.toDomain(data as UserRow) : null;
  }

  async findByIdAndShop(id: number, shopId: number): Promise<User | null> {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? UserMapper.toDomain(data as UserRow) : null;
  }

  async findFirstActiveByShop(shopId: number): Promise<User | null> {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('id')
      .limit(1);
    if (error) throw new BadRequestException(error.message);
    return data?.[0] ? UserMapper.toDomain(data[0] as UserRow) : null;
  }

  async findActiveSummariesByShop(shopId: number) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, name, role, biometric_enabled')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('id');
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => UserMapper.toSummary(row as UserRow));
  }

  async findAllByShop(shopId: number): Promise<User[]> {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('shop_id', shopId)
      .order('id');
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => UserMapper.toDomain(row as UserRow));
  }

  async existsByNameInShop(shopId: number, name: string): Promise<boolean> {
    const { count, error } = await this.supabase.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .ilike('name', name);
    if (error) throw new BadRequestException(error.message);
    return (count ?? 0) > 0;
  }

  async existsByNameInShopExcluding(
    shopId: number,
    name: string,
    excludeUserId: number,
  ): Promise<boolean> {
    const { count, error } = await this.supabase.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .neq('id', excludeUserId)
      .ilike('name', name);
    if (error) throw new BadRequestException(error.message);
    return (count ?? 0) > 0;
  }

  async countOwnersByShop(shopId: number): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('role', 'owner')
      .eq('is_active', true);
    if (error) throw new BadRequestException(error.message);
    return count ?? 0;
  }

  async create(data: Record<string, unknown>): Promise<User> {
    const { data: row, error } = await this.supabase.db
      .from('users')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) {
      if (error) throwSupabaseError(error);
      throw new BadRequestException('Création utilisateur impossible.');
    }
    return UserMapper.toDomain(row as UserRow);
  }

  async updateInShop(id: number, shopId: number, data: Record<string, unknown>): Promise<void> {
    const { data: row, error } = await this.supabase.db
      .from('users')
      .update(data)
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!row) {
      throw new NotFoundException('Utilisateur introuvable dans cette boutique.');
    }
  }

  async updateById(id: number, data: Record<string, unknown>): Promise<void> {
    const { data: row, error } = await this.supabase.db
      .from('users')
      .update(data)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!row) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
  }

  async findActiveByPhone(phone: string): Promise<User[]> {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('phone', phone)
      .eq('is_active', true)
      .order('id');

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => UserMapper.toDomain(row as UserRow));
  }
}
