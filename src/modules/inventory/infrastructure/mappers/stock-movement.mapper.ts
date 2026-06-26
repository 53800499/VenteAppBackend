import { StockMovement } from '../../domain/entities/stock-movement.entity';
import { StockMovementRow } from '../persistence/stock-movement.row';

export class StockMovementMapper {
  static toDomain(row: StockMovementRow): StockMovement {
    return new StockMovement(
      row.id,
      row.shop_id,
      row.product_id,
      row.user_id,
      row.type,
      row.quantity_change,
      row.quantity_before,
      row.quantity_after,
      row.reason,
      row.sale_id,
      row.unit_cost,
      row.created_at,
    );
  }
}
