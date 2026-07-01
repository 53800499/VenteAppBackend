import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import {
  ReportDebtRecoveryRaw,
  ReportPeriodData,
  ReportProfitLine,
  ReportSaleRow,
  ReportSellerRow,
  ReportTopProductRow,
} from '../../domain/entities/report.entity';
import { ReportLoadParams, ReportReadRepository } from '../../domain/repositories/report-read.repository';

interface SaleRow {
  id: number;
  shop_id: number;
  user_id: number;
  total_amount: number;
  amount_cash: number;
  amount_momo: number;
  amount_credit: number;
  created_at: number;
}

interface ProfitRow {
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
}

interface SaleItemRow {
  product_id: number | null;
  product_name: string;
  quantity: number;
  line_total: number;
}

interface SellerAggRow {
  user_id: number;
  users?: { name: string } | { name: string }[] | null;
}

@Injectable()
export class SupabaseReportReadRepository extends ReportReadRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async loadPeriodData(params: ReportLoadParams): Promise<ReportPeriodData> {
    const { shopIds, fromMs, toMs } = params;
    if (shopIds.length === 0) {
      return {
        sales: [],
        profitLines: [],
        topProducts: [],
        sellerPerformance: [],
        debtRecovery: { debtsCreatedAmount: 0, debtsRepaidAmount: 0 },
      };
    }

    const [sales, profitLines, topProducts, sellerPerformance, debtRecovery] = await Promise.all([
      this.fetchSales(shopIds, fromMs, toMs),
      this.fetchProfitLines(shopIds, fromMs, toMs),
      this.fetchTopProducts(shopIds, fromMs, toMs),
      params.includeSellerPerformance
        ? this.fetchSellerPerformance(shopIds, fromMs, toMs)
        : Promise.resolve([]),
      this.fetchDebtRecovery(shopIds, fromMs, toMs),
    ]);

    return { sales, profitLines, topProducts, sellerPerformance, debtRecovery };
  }

  private async fetchSales(shopIds: number[], fromMs: number, toMs: number): Promise<ReportSaleRow[]> {
    const { data, error } = await this.supabase.db
      .from('sales')
      .select('id, shop_id, user_id, total_amount, amount_cash, amount_momo, amount_credit, created_at')
      .in('shop_id', shopIds)
      .neq('status', 'cancelled')
      .gte('created_at', fromMs)
      .lte('created_at', toMs);
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => {
      const r = row as SaleRow;
      return {
        id: r.id,
        shopId: r.shop_id,
        userId: r.user_id,
        totalAmount: Number(r.total_amount),
        amountCash: Number(r.amount_cash),
        amountMomo: Number(r.amount_momo),
        amountCredit: Number(r.amount_credit),
        createdAt: r.created_at,
      };
    });
  }

  private async fetchProfitLines(
    shopIds: number[],
    fromMs: number,
    toMs: number,
  ): Promise<ReportProfitLine[]> {
    const { data, error } = await this.supabase.db
      .from('sale_items')
      .select('quantity, unit_price, unit_cost, sales!inner(status, created_at, shop_id)')
      .in('shop_id', shopIds)
      .neq('sales.status', 'cancelled')
      .gte('sales.created_at', fromMs)
      .lte('sales.created_at', toMs);
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => {
      const r = row as ProfitRow;
      return {
        quantity: Number(r.quantity),
        unitPrice: Number(r.unit_price),
        unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
      };
    });
  }

  private async fetchTopProducts(
    shopIds: number[],
    fromMs: number,
    toMs: number,
  ): Promise<ReportTopProductRow[]> {
    const { data, error } = await this.supabase.db
      .from('sale_items')
      .select('product_id, product_name, quantity, line_total, sales!inner(status, created_at, shop_id)')
      .in('shop_id', shopIds)
      .neq('sales.status', 'cancelled')
      .gte('sales.created_at', fromMs)
      .lte('sales.created_at', toMs);
    if (error) throw new BadRequestException(error.message);

    const byKey = new Map<string, { productId: number | null; productName: string; quantitySold: number; revenue: number }>();
    for (const row of data ?? []) {
      const r = row as SaleItemRow;
      const key = `${r.product_id ?? 'null'}:${r.product_name}`;
      const existing = byKey.get(key);
      const qty = Number(r.quantity);
      const revenue = Number(r.line_total);
      if (!existing) {
        byKey.set(key, {
          productId: r.product_id,
          productName: r.product_name,
          quantitySold: qty,
          revenue,
        });
      } else {
        existing.quantitySold += qty;
        existing.revenue += revenue;
      }
    }

    return [...byKey.values()];
  }

  private async fetchSellerPerformance(
    shopIds: number[],
    fromMs: number,
    toMs: number,
  ): Promise<ReportSellerRow[]> {
    const { data, error } = await this.supabase.db
      .from('sales')
      .select('user_id, total_amount, users(name)')
      .in('shop_id', shopIds)
      .neq('status', 'cancelled')
      .gte('created_at', fromMs)
      .lte('created_at', toMs);
    if (error) throw new BadRequestException(error.message);

    const byUser = new Map<number, { userId: number; userName: string | null; saleCount: number; totalRevenue: number }>();
    for (const row of data ?? []) {
      const r = row as SellerAggRow & { total_amount: number };
      const userId = r.user_id;
      const userRel = r.users;
      const userName = Array.isArray(userRel) ? userRel[0]?.name ?? null : userRel?.name ?? null;
      const existing = byUser.get(userId);
      const amount = Number(r.total_amount);
      if (!existing) {
        byUser.set(userId, { userId, userName, saleCount: 1, totalRevenue: amount });
      } else {
        existing.saleCount += 1;
        existing.totalRevenue += amount;
      }
    }

    return [...byUser.values()];
  }

  private async fetchDebtRecovery(
    shopIds: number[],
    fromMs: number,
    toMs: number,
  ): Promise<ReportDebtRecoveryRaw> {
    const [createdRes, repaidRes] = await Promise.all([
      this.supabase.db
        .from('debts')
        .select('original_amount')
        .in('shop_id', shopIds)
        .gte('created_at', fromMs)
        .lte('created_at', toMs)
        .neq('status', 'cancelled'),
      this.supabase.db
        .from('debt_payments')
        .select('amount')
        .in('shop_id', shopIds)
        .gte('created_at', fromMs)
        .lte('created_at', toMs),
    ]);

    if (createdRes.error) throw new BadRequestException(createdRes.error.message);
    if (repaidRes.error) throw new BadRequestException(repaidRes.error.message);

    return {
      debtsCreatedAmount: (createdRes.data ?? []).reduce(
        (sum, r) => sum + Number((r as { original_amount: number }).original_amount),
        0,
      ),
      debtsRepaidAmount: (repaidRes.data ?? []).reduce(
        (sum, r) => sum + Number((r as { amount: number }).amount),
        0,
      ),
    };
  }
}
