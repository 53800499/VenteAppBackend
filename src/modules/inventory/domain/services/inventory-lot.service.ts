import { BadRequestException, Injectable } from '@nestjs/common';
import { nowMs } from '../../../../shared/utils/time.util';
import {
  InventoryLotSourceType,
  InventoryLotStatus,
  LotAllocationSlice,
} from '../entities/inventory-lot.entity';
import { InventoryLotRepository } from '../repositories/inventory-lot.repository';
import { ProductRepository } from '../repositories/product.repository';

@Injectable()
export class InventoryLotService {
  constructor(
    private readonly lots: InventoryLotRepository,
    private readonly products: ProductRepository,
  ) {}

  async createLot(input: {
    shopId: number;
    productId: number;
    sourceType: string;
    sourceId?: number | null;
    purchaseReceiptItemId?: number | null;
    supplierId?: number | null;
    unitCost: number;
    quantity: number;
    batchNumber?: string | null;
    expiryDate?: number | null;
    receivedAt?: number;
  }) {
    if (input.quantity <= 0) {
      throw new BadRequestException('La quantité du lot doit être positive.');
    }
    const timestamp = input.receivedAt ?? nowMs();
    const lot = await this.lots.create({
      shop_id: input.shopId,
      product_id: input.productId,
      source_type: input.sourceType as typeof InventoryLotSourceType.PROCUREMENT_RECEIPT,
      source_id: input.sourceId ?? null,
      purchase_receipt_item_id: input.purchaseReceiptItemId ?? null,
      supplier_id: input.supplierId ?? null,
      unit_cost: input.unitCost,
      quantity_received: input.quantity,
      quantity_remaining: input.quantity,
      batch_number: input.batchNumber ?? null,
      expiry_date: input.expiryDate ?? null,
      received_at: timestamp,
      status: InventoryLotStatus.ACTIVE,
      created_at: timestamp,
    });
    await this.refreshProductStockFromLots(input.shopId, input.productId);
    return lot;
  }

  async allocateFifo(input: {
    shopId: number;
    productId: number;
    quantity: number;
  }): Promise<LotAllocationSlice[]> {
    if (input.quantity <= 0) return [];

    await this.ensureLotsForAllocation(input.shopId, input.productId);

    const activeLots = await this.lots.findActiveByProduct(input.shopId, input.productId);
    let remaining = input.quantity;
    const slices: LotAllocationSlice[] = [];

    for (const lot of activeLots) {
      if (remaining <= 0) break;
      const available = lot.quantityRemaining - lot.quantityReserved;
      const take = Math.min(available, remaining);
      if (take <= 0) continue;

      const newRemaining = lot.quantityRemaining - take;
      await this.lots.updateRemaining(
        lot.id,
        newRemaining,
        newRemaining <= 0 ? InventoryLotStatus.DEPLETED : InventoryLotStatus.ACTIVE,
        lot.version,
      );

      slices.push({ lotId: lot.id, quantity: take, unitCost: lot.unitCost });
      remaining -= take;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Stock lot insuffisant pour le produit #${input.productId} (manque ${remaining} unité(s)).`,
      );
    }

    await this.refreshProductStockFromLots(input.shopId, input.productId);
    return slices;
  }

  async recordSaleItemAllocations(input: {
    shopId: number;
    saleItemId: number;
    slices: LotAllocationSlice[];
    createdAt: number;
  }) {
    if (input.slices.length === 0) return;
    await this.lots.createAllocations(
      input.slices.map((slice) => ({
        shop_id: input.shopId,
        sale_item_id: input.saleItemId,
        inventory_lot_id: slice.lotId,
        quantity: slice.quantity,
        unit_cost: slice.unitCost,
        created_at: input.createdAt,
      })),
    );
  }

  async restoreLotsForSale(shopId: number, saleItemIds: number[]) {
    if (saleItemIds.length === 0) return;

    const allocations = await this.lots.findAllocationsBySaleItemIds(saleItemIds);
    const productIds = new Set<number>();

    for (const alloc of allocations) {
      const lot = await this.lots.findById(alloc.inventoryLotId);
      if (!lot) continue;

      const newRemaining = lot.quantityRemaining + alloc.quantity;
      await this.lots.updateRemaining(
        lot.id,
        newRemaining,
        InventoryLotStatus.ACTIVE,
        lot.version,
      );
      productIds.add(lot.productId);
    }

    await this.lots.deleteAllocationsBySaleItemIds(saleItemIds);

    for (const productId of productIds) {
      await this.refreshProductStockFromLots(shopId, productId);
    }
  }

  async refreshProductStockFromLots(shopId: number, productId: number) {
    const total = await this.lots.sumRemainingByProduct(shopId, productId);
    const product = await this.products.findByIdAndShop(productId, shopId);
    if (!product) return;

    await this.products.updateInShop(productId, shopId, {
      quantity_in_stock: total,
      updated_at: nowMs(),
      version: product.version + 1,
    });
  }

  async ensureLotsForAllocation(shopId: number, productId: number) {
    const activeLots = await this.lots.findActiveByProduct(shopId, productId);
    if (activeLots.length > 0) return;

    const product = await this.products.findByIdAndShop(productId, shopId);
    if (!product || product.quantityInStock <= 0) return;

    const timestamp = nowMs();
    await this.lots.create({
      shop_id: shopId,
      product_id: productId,
      source_type: InventoryLotSourceType.INITIAL_MIGRATION,
      unit_cost: product.priceBuy ?? 0,
      quantity_received: product.quantityInStock,
      quantity_remaining: product.quantityInStock,
      received_at: timestamp,
      status: InventoryLotStatus.ACTIVE,
      created_at: timestamp,
    });
  }

  listByShop(shopId: number, productId?: number) {
    return this.lots.findByShop(shopId, productId);
  }

  static weightedUnitCost(slices: LotAllocationSlice[]): number {
    return InventoryLotRepository.weightedUnitCost(slices);
  }
}
