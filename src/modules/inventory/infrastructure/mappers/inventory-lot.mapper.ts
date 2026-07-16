import {
  InventoryLot,
  InventoryLotSourceTypeValue,
  InventoryLotStatusValue,
} from '../../domain/entities/inventory-lot.entity';
import { InventoryLotRow } from '../persistence/inventory-lot.row';

export class InventoryLotMapper {
  static toDomain(row: InventoryLotRow): InventoryLot {
    return new InventoryLot(
      row.id,
      row.shop_id,
      row.product_id,
      row.source_type as InventoryLotSourceTypeValue,
      row.source_id,
      row.purchase_receipt_item_id,
      row.supplier_id,
      Number(row.unit_cost),
      row.quantity_received,
      row.quantity_remaining,
      row.batch_number,
      row.expiry_date,
      row.received_at,
      row.status as InventoryLotStatusValue,
      row.created_at,
      row.version,
    );
  }

  static toDto(lot: InventoryLot) {
    return {
      id: lot.id,
      shopId: lot.shopId,
      productId: lot.productId,
      sourceType: lot.sourceType,
      sourceId: lot.sourceId,
      purchaseReceiptItemId: lot.purchaseReceiptItemId,
      supplierId: lot.supplierId,
      unitCost: lot.unitCost,
      quantityReceived: lot.quantityReceived,
      quantityRemaining: lot.quantityRemaining,
      batchNumber: lot.batchNumber,
      expiryDate: lot.expiryDate,
      receivedAt: lot.receivedAt,
      status: lot.status,
      createdAt: lot.createdAt,
      version: lot.version,
    };
  }
}
