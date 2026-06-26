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
}
