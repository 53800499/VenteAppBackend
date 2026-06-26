export type StockMovementType =
  | 'sale'
  | 'restock'
  | 'adjustment'
  | 'loss'
  | 'return'
  | 'initial'
  | 'sale_cancel';

export class StockMovement {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly productId: number,
    public readonly userId: number,
    public readonly type: StockMovementType,
    public readonly quantityChange: number,
    public readonly quantityBefore: number,
    public readonly quantityAfter: number,
    public readonly reason: string | null,
    public readonly saleId: number | null,
    public readonly unitCost: number | null,
    public readonly createdAt: number,
  ) {}
}
