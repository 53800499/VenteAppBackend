import {
  InventoryLot,
  InventoryLotSourceTypeValue,
  InventoryLotStatusValue,
  LotAllocationSlice,
} from '../entities/inventory-lot.entity';

export type CreateInventoryLotData = {
  shop_id: number;
  product_id: number;
  source_type: InventoryLotSourceTypeValue;
  source_id?: number | null;
  purchase_receipt_item_id?: number | null;
  supplier_id?: number | null;
  unit_cost: number;
  quantity_received: number;
  quantity_remaining: number;
  batch_number?: string | null;
  expiry_date?: number | null;
  received_at: number;
  status?: InventoryLotStatusValue;
  created_at: number;
};

export type CreateSaleItemLotAllocationData = {
  shop_id: number;
  sale_item_id: number;
  inventory_lot_id: number;
  quantity: number;
  unit_cost: number;
  created_at: number;
};

export abstract class InventoryLotRepository {
  abstract create(data: CreateInventoryLotData): Promise<InventoryLot>;

  abstract findActiveByProduct(shopId: number, productId: number): Promise<InventoryLot[]>;

  abstract findByShop(shopId: number, productId?: number): Promise<InventoryLot[]>;

  abstract findById(lotId: number): Promise<InventoryLot | null>;

  abstract findByPurchaseReceiptItemId(
    shopId: number,
    purchaseReceiptItemId: number,
  ): Promise<InventoryLot | null>;

  abstract updateRemaining(
    lotId: number,
    quantityRemaining: number,
    status: InventoryLotStatusValue,
    version: number,
  ): Promise<void>;

  abstract createAllocations(data: CreateSaleItemLotAllocationData[]): Promise<void>;

  abstract findAllocationsBySaleItemIds(saleItemIds: number[]): Promise<
    {
      id: number;
      saleItemId: number;
      inventoryLotId: number;
      quantity: number;
      unitCost: number;
    }[]
  >;

  abstract deleteAllocationsBySaleItemIds(saleItemIds: number[]): Promise<void>;

  abstract sumRemainingByProduct(shopId: number, productId: number): Promise<number>;

  static weightedUnitCost(slices: LotAllocationSlice[]): number {
    if (slices.length === 0) return 0;
    let totalCost = 0;
    let totalQty = 0;
    for (const s of slices) {
      totalCost += s.quantity * s.unitCost;
      totalQty += s.quantity;
    }
    if (totalQty <= 0) return 0;
    return Math.round(totalCost / totalQty);
  }
}
