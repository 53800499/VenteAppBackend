import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { Category } from '../../domain/entities/category.entity';
import {
  CategoryRepository,
  CreateCategoryData,
} from '../../domain/repositories/category.repository';
import { CategoryMapper } from '../mappers/category.mapper';
import { CategoryRow } from '../persistence/category.row';

@Injectable()
export class SupabaseCategoryRepository extends CategoryRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findAllByShop(shopId: number, activeOnly = false): Promise<Category[]> {
    let query = this.supabase.db
      .from('categories')
      .select('*')
      .eq('shop_id', shopId)
      .order('sort_order')
      .order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => CategoryMapper.toDomain(row as CategoryRow));
  }

  async findByIdAndShop(id: number, shopId: number): Promise<Category | null> {
    const { data, error } = await this.supabase.db
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? CategoryMapper.toDomain(data as CategoryRow) : null;
  }

  async existsByNameInShop(shopId: number, name: string, excludeId?: number): Promise<boolean> {
    let query = this.supabase.db
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .ilike('name', name.trim());

    if (excludeId != null) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (count ?? 0) > 0;
  }

  async create(data: CreateCategoryData): Promise<Category> {
    const { data: row, error } = await this.supabase.db
      .from('categories')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Création catégorie impossible.');
    }
    return CategoryMapper.toDomain(row as CategoryRow);
  }

  async updateInShop(id: number, shopId: number, data: Record<string, unknown>): Promise<Category> {
    const { data: row, error } = await this.supabase.db
      .from('categories')
      .update(data)
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('*')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!row) {
      throw new NotFoundException('Catégorie introuvable dans cette boutique.');
    }
    return CategoryMapper.toDomain(row as CategoryRow);
  }

  async deleteInShop(id: number, shopId: number): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) {
      throw new NotFoundException('Catégorie introuvable dans cette boutique.');
    }
  }
}
