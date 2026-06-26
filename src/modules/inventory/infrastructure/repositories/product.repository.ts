import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { Product } from '../../domain/entities/product.entity';
import {
  CreateProductData,
  ProductListFilters,
  ProductRepository,
} from '../../domain/repositories/product.repository';
import { ProductMapper } from '../mappers/product.mapper';
import { ProductRow } from '../persistence/product.row';

@Injectable()
export class SupabaseProductRepository extends ProductRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findByIdAndShop(id: number, shopId: number): Promise<Product | null> {
    const { data, error } = await this.supabase.db
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? ProductMapper.toDomain(data as ProductRow) : null;
  }

  async listByShop(shopId: number, filters: ProductListFilters = {}): Promise<Product[]> {
    let query = this.supabase.db.from('products').select('*').eq('shop_id', shopId);

    if (!filters.includeArchived) {
      query = query.eq('is_archived', false);
    }

    if (filters.categoryId != null) {
      query = query.eq('category_id', filters.categoryId);
    }

    if (filters.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`name.ilike.${term},sku.ilike.${term}`);
    }

    const sort = filters.sort ?? 'name';
    if (sort === 'stock') {
      query = query.order('quantity_in_stock', { ascending: true });
    } else if (sort === 'price') {
      query = query.order('price_sell', { ascending: true });
    } else {
      query = query.order('name', { ascending: true });
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);

    let products = (data ?? []).map((row) => ProductMapper.toDomain(row as ProductRow));

    if (filters.lowStockOnly) {
      const defaultThreshold = filters.defaultAlertThreshold ?? 5;
      products = products.filter((p) => {
        const threshold = p.alertThreshold ?? defaultThreshold;
        return p.quantityInStock <= threshold;
      });
    }

    return products;
  }

  async listLowStock(shopId: number, defaultThreshold: number): Promise<Product[]> {
    return this.listByShop(shopId, {
      lowStockOnly: true,
      defaultAlertThreshold: defaultThreshold,
      includeArchived: false,
      sort: 'stock',
    });
  }

  async create(data: CreateProductData): Promise<Product> {
    const { data: row, error } = await this.supabase.db
      .from('products')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Création produit impossible.');
    }
    return ProductMapper.toDomain(row as ProductRow);
  }

  async updateInShop(id: number, shopId: number, data: Record<string, unknown>): Promise<Product> {
    const { data: row, error } = await this.supabase.db
      .from('products')
      .update(data)
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('*')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!row) {
      throw new BadRequestException('Produit introuvable dans cette boutique.');
    }
    return ProductMapper.toDomain(row as ProductRow);
  }

  async hasSaleItems(productId: number, shopId: number): Promise<boolean> {
    return (await this.countSaleItems(productId, shopId)) > 0;
  }

  async countSaleItems(productId: number, shopId: number): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('sale_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('shop_id', shopId);
    if (error) throw new BadRequestException(error.message);
    return count ?? 0;
  }

  async countByCategoryInShop(categoryId: number, shopId: number): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId)
      .eq('shop_id', shopId);
    if (error) throw new BadRequestException(error.message);
    return count ?? 0;
  }

  async deleteInShop(id: number, shopId: number): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('products')
      .delete()
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) {
      throw new BadRequestException('Produit introuvable dans cette boutique.');
    }
  }
}
