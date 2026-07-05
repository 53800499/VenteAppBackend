import { Injectable } from '@nestjs/common';
import { beninDayStart, formatBeninDate } from '../../../../shared/utils/benin-period-range.util';
import {
  CategorySalesSummary,
  MarginProductLine,
  MarginSummary,
  PriceDeviationLine,
  SalesAnalysisItemRow,
  SalesAnalysisSaleRow,
  SalesTrendPoint,
  SalesTrendSummary,
} from '../entities/sales-analysis.entity';

@Injectable()
export class SalesAnalysisAggregationService {
  aggregateCategories(items: SalesAnalysisItemRow[]): CategorySalesSummary[] {
    const byCategory = new Map<string, {
      categoryId: number | null;
      categoryName: string;
      productKeys: Set<string>;
      quantitySold: number;
      revenue: number;
    }>();

    for (const row of items) {
      const key = row.categoryId?.toString() ?? 'none';
      let acc = byCategory.get(key);
      if (!acc) {
        acc = {
          categoryId: row.categoryId,
          categoryName: row.categoryName ?? 'Sans catégorie',
          productKeys: new Set(),
          quantitySold: 0,
          revenue: 0,
        };
        byCategory.set(key, acc);
      }
      acc.productKeys.add(`${row.productId ?? 'null'}:${row.productName}`);
      acc.quantitySold += row.quantity;
      acc.revenue += row.lineTotal;
    }

    return [...byCategory.values()]
      .map((acc) => ({
        categoryId: acc.categoryId,
        categoryName: acc.categoryName,
        productCount: acc.productKeys.size,
        quantitySold: acc.quantitySold,
        revenue: acc.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  aggregateMargins(items: SalesAnalysisItemRow[], topLimit = 15): MarginSummary {
    if (items.length === 0) {
      return {
        totalRevenue: 0,
        totalCost: 0,
        estimatedProfit: 0,
        linesWithCost: 0,
        totalLines: 0,
        topProducts: [],
      };
    }

    let totalRevenue = 0;
    let totalCost = 0;
    let linesWithCost = 0;
    const byProduct = new Map<string, {
      productId: number | null;
      productName: string;
      quantitySold: number;
      revenue: number;
      estimatedCost: number;
    }>();

    for (const row of items) {
      totalRevenue += row.lineTotal;
      const unitCost = row.unitCost ?? row.priceBuy;
      const lineCost =
        unitCost != null ? Math.round(unitCost * row.quantity) : null;

      if (lineCost != null) {
        totalCost += lineCost;
        linesWithCost++;
      }

      const key = `${row.productId ?? 'null'}:${row.productName}`;
      let acc = byProduct.get(key);
      if (!acc) {
        acc = {
          productId: row.productId,
          productName: row.productName,
          quantitySold: 0,
          revenue: 0,
          estimatedCost: 0,
        };
        byProduct.set(key, acc);
      }
      acc.quantitySold += row.quantity;
      acc.revenue += row.lineTotal;
      if (lineCost != null) acc.estimatedCost += lineCost;
    }

    const topProducts: MarginProductLine[] = [...byProduct.values()]
      .map((line) => ({
        productId: line.productId,
        productName: line.productName,
        quantitySold: line.quantitySold,
        revenue: line.revenue,
        estimatedCost: line.estimatedCost,
        estimatedProfit: line.revenue - line.estimatedCost,
      }))
      .filter((line) => line.estimatedCost > 0)
      .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
      .slice(0, topLimit);

    return {
      totalRevenue,
      totalCost,
      estimatedProfit: totalRevenue - totalCost,
      linesWithCost,
      totalLines: items.length,
      topProducts,
    };
  }

  aggregatePriceDeviations(items: SalesAnalysisItemRow[]): PriceDeviationLine[] {
    const deviations: PriceDeviationLine[] = [];

    for (const row of items) {
      const belowCatalog =
        row.catalogPrice != null && row.unitPrice < row.catalogPrice;
      const aboveCatalog =
        row.catalogPrice != null && row.unitPrice > row.catalogPrice;
      if (row.discountAmount > 0 || belowCatalog || aboveCatalog) {
        deviations.push({
          saleId: row.saleId,
          soldAt: row.soldAt,
          productId: row.productId,
          productName: row.productName,
          catalogPrice: row.catalogPrice,
          unitPrice: row.unitPrice,
          discountAmount: row.discountAmount,
          sellerName: row.sellerName,
        });
      }
    }

    return deviations.sort((a, b) => b.soldAt - a.soldAt);
  }

  aggregateTrends(
    sales: SalesAnalysisSaleRow[],
    items: SalesAnalysisItemRow[],
  ): SalesTrendSummary {
    const byDay = new Map<number, {
      bucketStartMs: number;
      revenue: number;
      saleCount: number;
      quantitySold: number;
    }>();

    for (const sale of sales) {
      const bucket = beninDayStart(sale.createdAt);
      let acc = byDay.get(bucket);
      if (!acc) {
        acc = { bucketStartMs: bucket, revenue: 0, saleCount: 0, quantitySold: 0 };
        byDay.set(bucket, acc);
      }
      acc.saleCount++;
      acc.revenue += sale.totalAmount;
    }

    for (const row of items) {
      const bucket = beninDayStart(row.soldAt);
      let acc = byDay.get(bucket);
      if (!acc) {
        acc = { bucketStartMs: bucket, revenue: 0, saleCount: 0, quantitySold: 0 };
        byDay.set(bucket, acc);
      }
      acc.quantitySold += row.quantity;
    }

    const points: SalesTrendPoint[] = [...byDay.values()]
      .sort((a, b) => a.bucketStartMs - b.bucketStartMs)
      .map((acc) => ({
        bucketStartMs: acc.bucketStartMs,
        label: formatBeninDate(acc.bucketStartMs),
        revenue: acc.revenue,
        saleCount: acc.saleCount,
        quantitySold: acc.quantitySold,
      }));

    let totalRevenue = 0;
    let totalSaleCount = 0;
    for (const point of points) {
      totalRevenue += point.revenue;
      totalSaleCount += point.saleCount;
    }

    return { points, totalRevenue, totalSaleCount };
  }
}
