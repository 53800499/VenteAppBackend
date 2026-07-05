export interface SalesAnalysisSaleRow {
  id: number;
  totalAmount: number;
  createdAt: number;
}

export interface SalesAnalysisItemRow {
  saleId: number;
  soldAt: number;
  userId: number;
  sellerName: string | null;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount: number;
  unitCost: number | null;
  catalogPrice: number | null;
  priceBuy: number | null;
  categoryId: number | null;
  categoryName: string | null;
}

export interface CategorySalesSummary {
  categoryId: number | null;
  categoryName: string;
  productCount: number;
  quantitySold: number;
  revenue: number;
}

export interface MarginProductLine {
  productId: number | null;
  productName: string;
  quantitySold: number;
  revenue: number;
  estimatedCost: number;
  estimatedProfit: number;
}

export interface MarginSummary {
  totalRevenue: number;
  totalCost: number;
  estimatedProfit: number;
  linesWithCost: number;
  totalLines: number;
  topProducts: MarginProductLine[];
}

export interface PriceDeviationLine {
  saleId: number;
  soldAt: number;
  productId: number | null;
  productName: string;
  catalogPrice: number | null;
  unitPrice: number;
  discountAmount: number;
  sellerName: string | null;
}

export interface SalesTrendPoint {
  bucketStartMs: number;
  label: string;
  revenue: number;
  saleCount: number;
  quantitySold: number;
}

export interface SalesTrendSummary {
  points: SalesTrendPoint[];
  totalRevenue: number;
  totalSaleCount: number;
}

export interface SalesAnalysisPeriodData {
  sales: SalesAnalysisSaleRow[];
  items: SalesAnalysisItemRow[];
}
