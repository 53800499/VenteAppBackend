import { Product } from '../entities/product.entity';

export type ProductSortField = 'name' | 'stock' | 'price';

export interface ProductListFilters {
  categoryId?: number;
  search?: string;
  lowStockOnly?: boolean;
  includeArchived?: boolean;
  sort?: ProductSortField;
  defaultAlertThreshold?: number;
}

export interface CreateProductData {
  shop_id: number;
  category_id: number;
  name: string;
  sku?: string | null;
  quantity_in_stock: number;
  alert_threshold: number;
  price_buy?: number | null;
  price_sell: number;
  created_at: number;
  updated_at: number;
}

export abstract class ProductRepository {
  abstract findByIdAndShop(id: number, shopId: number): Promise<Product | null>;
  abstract listByShop(shopId: number, filters?: ProductListFilters): Promise<Product[]>;
  abstract listLowStock(shopId: number, defaultThreshold: number): Promise<Product[]>;
  abstract create(data: CreateProductData): Promise<Product>;
  abstract updateInShop(id: number, shopId: number, data: Record<string, unknown>): Promise<Product>;
  abstract hasSaleItems(productId: number, shopId: number): Promise<boolean>;
  abstract countSaleItems(productId: number, shopId: number): Promise<number>;
  abstract countByCategoryInShop(categoryId: number, shopId: number): Promise<number>;
  abstract deleteInShop(id: number, shopId: number): Promise<void>;
}
