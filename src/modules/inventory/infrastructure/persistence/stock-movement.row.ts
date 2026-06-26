import { StockMovementType } from '../../domain/entities/stock-movement.entity';

export interface StockMovementRow {
  id: number;
  shop_id: number;
  product_id: number;
  user_id: number;
  type: StockMovementType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  sale_id: number | null;
  unit_cost: number | null;
  created_at: number;
}
