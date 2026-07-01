export interface ReportSaleRow {
  readonly id: number;
  readonly shopId: number;
  readonly userId: number;
  readonly totalAmount: number;
  readonly amountCash: number;
  readonly amountMomo: number;
  readonly amountCredit: number;
  readonly createdAt: number;
}

export interface ReportProfitLine {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly unitCost: number | null;
}

export interface ReportTopProductRow {
  readonly productId: number | null;
  readonly productName: string;
  readonly quantitySold: number;
  readonly revenue: number;
}

export interface ReportSellerRow {
  readonly userId: number;
  readonly userName: string | null;
  readonly saleCount: number;
  readonly totalRevenue: number;
}

export interface ReportDebtRecoveryRaw {
  readonly debtsCreatedAmount: number;
  readonly debtsRepaidAmount: number;
}

export interface ReportPeriodData {
  readonly sales: ReportSaleRow[];
  readonly profitLines: ReportProfitLine[];
  readonly topProducts: ReportTopProductRow[];
  readonly sellerPerformance: ReportSellerRow[];
  readonly debtRecovery: ReportDebtRecoveryRaw;
}
