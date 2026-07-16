import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import {
  InventoryLot,
  InventoryLotStatus,
} from '../../domain/entities/inventory-lot.entity';
import {
  CreateInventoryLotData,
  CreateSaleItemLotAllocationData,
  InventoryLotRepository,
} from '../../domain/repositories/inventory-lot.repository';
import { InventoryLotMapper } from '../mappers/inventory-lot.mapper';
import {
  InventoryLotRow,
  SaleItemLotAllocationRow,
} from '../persistence/inventory-lot.row';

@Injectable()
export class SupabaseInventoryLotRepository extends InventoryLotRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(data: CreateInventoryLotData): Promise<InventoryLot> {
    const { data: row, error } = await this.supabase.db
      .from('inventory_lots')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Création lot impossible.');
    }
    return InventoryLotMapper.toDomain(row as InventoryLotRow);
  }

  async findActiveByProduct(shopId: number, productId: number): Promise<InventoryLot[]> {
    const { data, error } = await this.supabase.db
      .from('inventory_lots')
      .select('*')
      .eq('shop_id', shopId)
      .eq('product_id', productId)
      .gt('quantity_remaining', 0)
      .order('received_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => InventoryLotMapper.toDomain(row as InventoryLotRow));
  }

  async findByShop(shopId: number, productId?: number): Promise<InventoryLot[]> {
    let query = this.supabase.db.from('inventory_lots').select('*').eq('shop_id', shopId);
    if (productId != null) {
      query = query.eq('product_id', productId);
    }
    query = query.order('received_at', { ascending: true }).order('id', { ascending: true });
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => InventoryLotMapper.toDomain(row as InventoryLotRow));
  }

  async findById(lotId: number): Promise<InventoryLot | null> {
    const { data, error } = await this.supabase.db
      .from('inventory_lots')
      .select('*')
      .eq('id', lotId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return InventoryLotMapper.toDomain(data as InventoryLotRow);
  }

  async findByPurchaseReceiptItemId(
    shopId: number,
    purchaseReceiptItemId: number,
  ): Promise<InventoryLot | null> {
    const { data, error } = await this.supabase.db
      .from('inventory_lots')
      .select('*')
      .eq('shop_id', shopId)
      .eq('purchase_receipt_item_id', purchaseReceiptItemId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return InventoryLotMapper.toDomain(data as InventoryLotRow);
  }

  async updateRemaining(
    lotId: number,
    quantityRemaining: number,
    status: string,
    version: number,
  ): Promise<void> {
    await this.updateStockState(lotId, quantityRemaining, undefined, status, version);
  }

  async updateStockState(
    lotId: number,
    quantityRemaining: number,
    quantityReserved: number | undefined,
    status: string,
    version: number,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      quantity_remaining: quantityRemaining,
      status,
      version: version + 1,
    };
    if (quantityReserved != null) {
      patch.quantity_reserved = quantityReserved;
    }
    const { error } = await this.supabase.db
      .from('inventory_lots')
      .update(patch)
      .eq('id', lotId);
    if (error) throw new BadRequestException(error.message);
  }

  async createAllocations(data: CreateSaleItemLotAllocationData[]): Promise<void> {
    if (data.length === 0) return;
    const { error } = await this.supabase.db.from('sale_item_lot_allocations').insert(data);
    if (error) throw new BadRequestException(error.message);
  }

  async findAllocationsBySaleItemIds(saleItemIds: number[]) {
    if (saleItemIds.length === 0) return [];
    const { data, error } = await this.supabase.db
      .from('sale_item_lot_allocations')
      .select('*')
      .in('sale_item_id', saleItemIds);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row: SaleItemLotAllocationRow) => ({
      id: row.id,
      saleItemId: row.sale_item_id,
      inventoryLotId: row.inventory_lot_id,
      quantity: row.quantity,
      unitCost: Number(row.unit_cost),
    }));
  }

  async deleteAllocationsBySaleItemIds(saleItemIds: number[]): Promise<void> {
    if (saleItemIds.length === 0) return;
    const { error } = await this.supabase.db
      .from('sale_item_lot_allocations')
      .delete()
      .in('sale_item_id', saleItemIds);
    if (error) throw new BadRequestException(error.message);
  }

  async sumRemainingByProduct(shopId: number, productId: number): Promise<number> {
    const { data, error } = await this.supabase.db
      .from('inventory_lots')
      .select('quantity_remaining')
      .eq('shop_id', shopId)
      .eq('product_id', productId);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).reduce(
      (sum, row) => sum + (row.quantity_remaining as number),
      0,
    );
  }
}
