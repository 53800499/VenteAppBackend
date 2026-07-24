export const InventoryLotSourceType = {
  INITIAL_MIGRATION: 'initial_migration',
  PROCUREMENT_RECEIPT: 'procurement_receipt',
  DIRECT_PROCUREMENT: 'direct_procurement',
  MANUAL_RESTOCK: 'manual_restock',
  SALE_CANCEL_RESTORE: 'sale_cancel_restore',
  STOCK_TRANSFER_IN: 'stock_transfer_in',
  SALE_REPLACEMENT_RETURN: 'sale_replacement_return',
} as const;

export type InventoryLotSourceTypeValue =
  (typeof InventoryLotSourceType)[keyof typeof InventoryLotSourceType];

export const InventoryLotStatus = {
  ACTIVE: 'active',
  DEPLETED: 'depleted',
} as const;

export type InventoryLotStatusValue =
  (typeof InventoryLotStatus)[keyof typeof InventoryLotStatus];

export class InventoryLot {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly productId: number,
    public readonly sourceType: InventoryLotSourceTypeValue,
    public readonly sourceId: number | null,
    public readonly purchaseReceiptItemId: number | null,
    public readonly supplierId: number | null,
    public readonly unitCost: number,
    public readonly quantityReceived: number,
    public readonly quantityRemaining: number,
    public readonly quantityReserved: number,
    public readonly batchNumber: string | null,
    public readonly expiryDate: number | null,
    public readonly receivedAt: number,
    public readonly status: InventoryLotStatusValue,
    public readonly createdAt: number,
    public readonly version: number,
  ) {}
}

export type LotAllocationSlice = {
  lotId: number;
  quantity: number;
  unitCost: number;
};
