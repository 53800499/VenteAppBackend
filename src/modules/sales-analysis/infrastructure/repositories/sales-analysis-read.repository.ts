import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import {
  SalesAnalysisItemRow,
  SalesAnalysisPeriodData,
  SalesAnalysisSaleRow,
} from '../../domain/entities/sales-analysis.entity';
import {
  SalesAnalysisLoadParams,
  SalesAnalysisReadRepository,
} from '../../domain/repositories/sales-analysis-read.repository';

interface SaleRow {
  id: number;
  total_amount: number;
  created_at: number;
}

interface SaleItemDbRow {
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  discount_amount: number;
  unit_cost: number | null;
  sales: {
    id: number;
    user_id: number;
    created_at: number;
    status: string;
    users?: { name: string } | { name: string }[] | null;
  };
  products?: {
    price_sell: number;
    price_buy: number | null;
    category_id: number | null;
    categories?: { name: string } | { name: string }[] | null;
  } | null;
}

@Injectable()
export class SupabaseSalesAnalysisReadRepository extends SalesAnalysisReadRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async loadPeriodData(params: SalesAnalysisLoadParams): Promise<SalesAnalysisPeriodData> {
    const { shopIds, fromMs, toMs } = params;
    if (shopIds.length === 0) {
      return { sales: [], items: [] };
    }

    const [sales, items] = await Promise.all([
      this.fetchSales(shopIds, fromMs, toMs),
      this.fetchSaleItems(shopIds, fromMs, toMs),
    ]);

    return { sales, items };
  }

  private async fetchSales(
    shopIds: number[],
    fromMs: number,
    toMs: number,
  ): Promise<SalesAnalysisSaleRow[]> {
    const { data, error } = await this.supabase.db
      .from('sales')
      .select('id, total_amount, created_at')
      .in('shop_id', shopIds)
      .neq('status', 'cancelled')
      .gte('created_at', fromMs)
      .lte('created_at', toMs);
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => {
      const r = row as SaleRow;
      return {
        id: r.id,
        totalAmount: Number(r.total_amount),
        createdAt: r.created_at,
      };
    });
  }

  private async fetchSaleItems(
    shopIds: number[],
    fromMs: number,
    toMs: number,
  ): Promise<SalesAnalysisItemRow[]> {
    const { data, error } = await this.supabase.db
      .from('sale_items')
      .select(
        [
          'product_id',
          'product_name',
          'quantity',
          'unit_price',
          'line_total',
          'discount_amount',
          'unit_cost',
          'sales!inner(id, user_id, created_at, status, users(name))',
          'products(price_sell, price_buy, category_id, categories(name))',
        ].join(', '),
      )
      .in('shop_id', shopIds)
      .neq('sales.status', 'cancelled')
      .gte('sales.created_at', fromMs)
      .lte('sales.created_at', toMs);
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => {
      const r = row as unknown as SaleItemDbRow;
      const sale = r.sales;
      const product = r.products;
      const users = sale.users;
      const sellerName = Array.isArray(users) ? users[0]?.name ?? null : users?.name ?? null;
      const categories = product?.categories;
      const categoryName = Array.isArray(categories)
        ? categories[0]?.name ?? null
        : categories?.name ?? null;

      return {
        saleId: sale.id,
        soldAt: sale.created_at,
        userId: sale.user_id,
        sellerName,
        productId: r.product_id,
        productName: r.product_name,
        quantity: Number(r.quantity),
        unitPrice: Number(r.unit_price),
        lineTotal: Number(r.line_total),
        discountAmount: Number(r.discount_amount ?? 0),
        unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
        catalogPrice: product ? Number(product.price_sell) : null,
        priceBuy: product?.price_buy != null ? Number(product.price_buy) : null,
        categoryId: product?.category_id ?? null,
        categoryName,
      };
    });
  }
}
