import { Category } from '../entities/category.entity';

export interface CreateCategoryData {
  shop_id: number;
  name: string;
  sort_order?: number;
  created_at: number;
  updated_at: number;
}

export abstract class CategoryRepository {
  abstract findAllByShop(shopId: number, activeOnly?: boolean): Promise<Category[]>;
  abstract findByIdAndShop(id: number, shopId: number): Promise<Category | null>;
  abstract existsByNameInShop(shopId: number, name: string, excludeId?: number): Promise<boolean>;
  abstract create(data: CreateCategoryData): Promise<Category>;
  abstract updateInShop(id: number, shopId: number, data: Record<string, unknown>): Promise<Category>;
  abstract deleteInShop(id: number, shopId: number): Promise<void>;
}
