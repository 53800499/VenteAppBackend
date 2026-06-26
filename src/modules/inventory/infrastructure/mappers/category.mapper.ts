import { Category } from '../../domain/entities/category.entity';
import { CategoryRow } from '../persistence/category.row';

export class CategoryMapper {
  static toDomain(row: CategoryRow): Category {
    return new Category(
      row.id,
      row.shop_id,
      row.name,
      row.is_active,
      row.sort_order,
      row.created_at,
      row.updated_at,
    );
  }
}
