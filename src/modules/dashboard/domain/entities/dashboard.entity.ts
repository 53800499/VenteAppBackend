export interface TodaySaleRow {
  readonly id: number;
  readonly totalAmount: number;
  readonly amountCash: number;
  readonly amountMomo: number;
  readonly amountCredit: number;
  readonly createdAt: number;
  readonly customerId: number | null;
  readonly customerName: string | null;
}

export interface SaleProfitRow {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly unitCost: number | null;
}

export interface DashboardSalesStats {
  readonly totalRevenue: number;
  readonly saleCount: number;
  readonly totalCash: number;
  readonly totalMomo: number;
  readonly totalCredit: number;
}

export interface DashboardDebtStats {
  readonly debtorCount: number;
  readonly totalDebt: number;
}

export interface DashboardSummaryRaw {
  readonly sales: TodaySaleRow[];
  readonly recentSales: TodaySaleRow[];
  readonly profitLines: SaleProfitRow[];
  readonly lowStockCount: number;
  readonly debts: DashboardDebtStats;
}
