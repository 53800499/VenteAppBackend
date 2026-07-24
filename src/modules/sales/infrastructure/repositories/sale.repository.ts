import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { Sale } from '../../domain/entities/sale.entity';
import {
  CreateSaleData,
  SaleLineInput,
  SaleListFilters,
  SaleRepository,
} from '../../domain/repositories/sale.repository';
import { SaleMapper } from '../mappers/sale.mapper';
import { SaleItemRow, SaleRow } from '../persistence/sale.row';

@Injectable()
export class SupabaseSaleRepository extends SaleRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findByIdAndShop(id: number, shopId: number): Promise<Sale | null> {
    const { data, error } = await this.supabase.db
      .from('sales')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;

    const items = await this.fetchItems(id, shopId);
    return SaleMapper.toDomain(data as SaleRow, items);
  }

  async listByShop(shopId: number, filters?: SaleListFilters): Promise<Sale[]> {
    let query = this.supabase.db.from('sales').select('*').eq('shop_id', shopId);

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.saleType) query = query.eq('sale_type', filters.saleType);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
    if (filters?.from) query = query.gte('created_at', filters.from);
    if (filters?.to) query = query.lte('created_at', filters.to);

    query = query.order('created_at', { ascending: false });
    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => SaleMapper.toDomain(row as SaleRow));
  }

  async countByShopOnDay(shopId: number, dayStartMs: number, dayEndMs: number): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .gte('created_at', dayStartMs)
      .lte('created_at', dayEndMs);
    if (error) throw new BadRequestException(error.message);
    return count ?? 0;
  }

  async createWithItems(sale: CreateSaleData, items: SaleLineInput[]): Promise<Sale> {
    const { data: saleRow, error: saleError } = await this.supabase.db
      .from('sales')
      .insert(sale)
      .select('*')
      .single();
    if (saleError || !saleRow) {
      throw new BadRequestException(saleError?.message ?? 'Création vente impossible.');
    }

    const saleId = (saleRow as SaleRow).id;
    const itemRows =
      items.length > 0
        ? items.map((item) => ({
            ...item,
            shop_id: sale.shop_id,
            sale_id: saleId,
            created_at: sale.created_at,
          }))
        : [];

    if (itemRows.length > 0) {
      const { error: itemsError } = await this.supabase.db.from('sale_items').insert(itemRows);
      if (itemsError) {
        throw new BadRequestException(itemsError.message);
      }
    }

    const createdItems = await this.fetchItems(saleId, sale.shop_id);
    return SaleMapper.toDomain(saleRow as SaleRow, createdItems);
  }

  async cancel(
    id: number,
    shopId: number,
    data: {
      cancel_reason: string;
      cancelled_by_user_id: number;
      cancelled_at: number;
      updated_at: number;
      version: number;
    },
  ): Promise<void> {
    const { data: row, error } = await this.supabase.db
      .from('sales')
      .update({
        status: 'cancelled',
        cancel_reason: data.cancel_reason,
        cancelled_by_user_id: data.cancelled_by_user_id,
        cancelled_at: data.cancelled_at,
        updated_at: data.updated_at,
        version: data.version,
      })
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!row) throw new NotFoundException('Vente introuvable.');
  }

  private async fetchItems(saleId: number, shopId: number): Promise<SaleItemRow[]> {
    const { data, error } = await this.supabase.db
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId)
      .eq('shop_id', shopId)
      .order('id');
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as SaleItemRow[];
  }

  async sumReturnedBySaleItem(
    shopId: number,
    saleId: number,
  ): Promise<Map<number, number>> {
    const { data: reps, error: repErr } = await this.supabase.db
      .from('sale_replacements')
      .select('id')
      .eq('shop_id', shopId)
      .eq('sale_id', saleId);
    if (repErr) throw new BadRequestException(repErr.message);
    const ids = (reps ?? []).map((r: { id: number }) => r.id);
    const map = new Map<number, number>();
    if (ids.length === 0) return map;

    const { data: items, error: itemErr } = await this.supabase.db
      .from('sale_replacement_items')
      .select('returned_sale_item_id, quantity_returned')
      .eq('shop_id', shopId)
      .in('replacement_id', ids);
    if (itemErr) throw new BadRequestException(itemErr.message);

    for (const row of items ?? []) {
      const key = row.returned_sale_item_id as number;
      map.set(key, (map.get(key) ?? 0) + (row.quantity_returned as number));
    }
    return map;
  }

  async createReplacement(data: {
    shop_id: number;
    sale_id: number;
    number: string;
    replaced_at: number;
    replaced_by: number;
    notes: string | null;
    items: Array<{
      returned_sale_item_id: number;
      returned_product_id: number;
      quantity_returned: number;
      issued_product_id: number;
      quantity_issued: number;
      unit_price_issued: number;
      reason: string;
    }>;
  }): Promise<{ id: number; number: string; serverId: string | null }> {
    const { data: row, error } = await this.supabase.db
      .from('sale_replacements')
      .insert({
        shop_id: data.shop_id,
        sale_id: data.sale_id,
        number: data.number,
        replaced_at: data.replaced_at,
        replaced_by: data.replaced_by,
        notes: data.notes,
        version: 1,
        sync_status: 'synced',
      })
      .select('id, number, server_id')
      .single();
    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Création remplacement impossible.');
    }

    const itemRows = data.items.map((it) => ({
      shop_id: data.shop_id,
      replacement_id: row.id,
      returned_sale_item_id: it.returned_sale_item_id,
      returned_product_id: it.returned_product_id,
      quantity_returned: it.quantity_returned,
      issued_product_id: it.issued_product_id,
      quantity_issued: it.quantity_issued,
      unit_price_issued: it.unit_price_issued,
      reason: it.reason,
      version: 1,
      sync_status: 'synced',
    }));

    const { error: itemsErr } = await this.supabase.db
      .from('sale_replacement_items')
      .insert(itemRows);
    if (itemsErr) {
      await this.supabase.db.from('sale_replacements').delete().eq('id', row.id);
      throw new BadRequestException(itemsErr.message);
    }

    return {
      id: row.id,
      number: row.number,
      serverId: row.server_id ?? null,
    };
  }

  async findSalesOrderIdBySale(
    shopId: number,
    saleId: number,
  ): Promise<number | null> {
    const { data, error } = await this.supabase.db
      .from('sales_order_deliveries')
      .select('sales_order_id')
      .eq('shop_id', shopId)
      .eq('sale_id', saleId)
      .maybeSingle();
    if (error) return null;
    return data?.sales_order_id ?? null;
  }

  async addSalesOrderHistory(data: {
    shop_id: number;
    sales_order_id: number;
    action: string;
    performed_by: number;
    performed_at: number;
    details: string;
  }): Promise<void> {
    await this.supabase.db.from('sales_order_history_entries').insert({
      shop_id: data.shop_id,
      sales_order_id: data.sales_order_id,
      action: data.action,
      performed_by: data.performed_by,
      performed_at: data.performed_at,
      details: data.details,
    });
  }
}
