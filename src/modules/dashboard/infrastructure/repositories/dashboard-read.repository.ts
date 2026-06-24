import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import {
  DashboardDebtStats,
  DashboardSummaryRaw,
  SaleProfitRow,
  TodaySaleRow,
} from '../../domain/entities/dashboard.entity';
import {
  DashboardDayRange,
  DashboardReadRepository,
} from '../../domain/repositories/dashboard-read.repository';

interface SaleRow {
  id: number;
  total_amount: number;
  amount_cash: number;
  amount_momo: number;
  amount_credit: number;
  created_at: number;
  customer_id: number | null;
  customers: { name: string } | { name: string }[] | null;
}

interface ProfitRow {
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  sales: { status: string; created_at: number } | { status: string; created_at: number }[];
}

interface DebtRow {
  amount_remaining: number;
  customer_id: number;
}

@Injectable()
export class SupabaseDashboardReadRepository extends DashboardReadRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async loadSummary(
    shopId: number,
    range: DashboardDayRange,
    defaultAlertThreshold: number,
    recentLimit: number,
  ): Promise<DashboardSummaryRaw> {
    const [allSales, recentSales, profitLines, lowStockCount, debts] = await Promise.all([
      this.fetchAllTodaySales(shopId, range),
      this.fetchRecentTodaySales(shopId, range, recentLimit),
      this.fetchTodayProfitLines(shopId, range),
      this.countLowStock(shopId, defaultAlertThreshold),
      this.fetchDebtSummary(shopId),
    ]);

    return {
      sales: allSales,
      recentSales,
      profitLines,
      lowStockCount,
      debts,
    };
  }

  private async fetchAllTodaySales(
    shopId: number,
    range: DashboardDayRange,
  ): Promise<TodaySaleRow[]> {
    const { data, error } = await this.supabase.db
      .from('sales')
      .select('id, total_amount, amount_cash, amount_momo, amount_credit, created_at, customer_id')
      .eq('shop_id', shopId)
      .neq('status', 'cancelled')
      .gte('created_at', range.dayStartMs)
      .lte('created_at', range.dayEndMs);

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => ({
      id: row.id as number,
      totalAmount: row.total_amount as number,
      amountCash: row.amount_cash as number,
      amountMomo: row.amount_momo as number,
      amountCredit: row.amount_credit as number,
      createdAt: row.created_at as number,
      customerId: row.customer_id as number | null,
      customerName: null,
    }));
  }

  private async fetchRecentTodaySales(
    shopId: number,
    range: DashboardDayRange,
    limit: number,
  ): Promise<TodaySaleRow[]> {
    const { data, error } = await this.supabase.db
      .from('sales')
      .select(
        'id, total_amount, amount_cash, amount_momo, amount_credit, created_at, customer_id, customers(name)',
      )
      .eq('shop_id', shopId)
      .neq('status', 'cancelled')
      .gte('created_at', range.dayStartMs)
      .lte('created_at', range.dayEndMs)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => this.toSaleRow(row as SaleRow));
  }

  private async fetchTodayProfitLines(
    shopId: number,
    range: DashboardDayRange,
  ): Promise<SaleProfitRow[]> {
    const { data, error } = await this.supabase.db
      .from('sale_items')
      .select('quantity, unit_price, unit_cost, sales!inner(status, created_at, shop_id)')
      .eq('shop_id', shopId)
      .eq('sales.shop_id', shopId)
      .neq('sales.status', 'cancelled')
      .gte('sales.created_at', range.dayStartMs)
      .lte('sales.created_at', range.dayEndMs);

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => {
      const r = row as unknown as ProfitRow;
      return {
        quantity: Number(r.quantity),
        unitPrice: r.unit_price,
        unitCost: r.unit_cost,
      };
    });
  }

  private async countLowStock(shopId: number, defaultThreshold: number): Promise<number> {
    const { data, error } = await this.supabase.db
      .from('products')
      .select('id, quantity_in_stock, alert_threshold')
      .eq('shop_id', shopId)
      .eq('is_archived', false);

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).filter((p) => {
      const threshold =
        p.alert_threshold !== null && p.alert_threshold !== undefined
          ? Number(p.alert_threshold)
          : defaultThreshold;
      return Number(p.quantity_in_stock) <= threshold;
    }).length;
  }

  private async fetchDebtSummary(shopId: number): Promise<DashboardDebtStats> {
    const { data, error } = await this.supabase.db
      .from('debts')
      .select('amount_remaining, customer_id')
      .eq('shop_id', shopId)
      .eq('status', 'open')
      .gt('amount_remaining', 0);

    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as DebtRow[];
    const uniqueDebtors = new Set(rows.map((r) => r.customer_id));

    return {
      debtorCount: uniqueDebtors.size,
      totalDebt: rows.reduce((sum, r) => sum + Number(r.amount_remaining), 0),
    };
  }

  private toSaleRow(row: SaleRow): TodaySaleRow {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    return {
      id: row.id,
      totalAmount: row.total_amount,
      amountCash: row.amount_cash,
      amountMomo: row.amount_momo,
      amountCredit: row.amount_credit,
      createdAt: row.created_at,
      customerId: row.customer_id,
      customerName: customer?.name ?? null,
    };
  }
}
