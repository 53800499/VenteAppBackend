import { Product } from '../../domain/entities/product.entity';
import { ProductRow } from '../persistence/product.row';

export class ProductMapper {
  static toDomain(row: ProductRow): Product {
    return new Product(
      row.id,
      row.shop_id,
      row.category_id,
      row.name,
      row.sku,
      row.quantity_in_stock,
      row.alert_threshold,
      row.price_buy,
      row.price_sell,
      row.is_archived,
      row.created_at,
      row.updated_at,
      row.version,
    );
  }
}
