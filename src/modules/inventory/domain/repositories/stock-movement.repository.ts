import { StockMovement, StockMovementType } from '../entities/stock-movement.entity';

export interface CreateStockMovementData {
  shop_id: number;
  product_id: number;
  user_id: number;
  type: StockMovementType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason?: string | null;
  sale_id?: number | null;
  unit_cost?: number | null;
  created_at: number;
}

export abstract class StockMovementRepository {
  abstract create(data: CreateStockMovementData): Promise<StockMovement>;
  abstract findRecentByProduct(productId: number, shopId: number, limit: number): Promise<StockMovement[]>;
}
