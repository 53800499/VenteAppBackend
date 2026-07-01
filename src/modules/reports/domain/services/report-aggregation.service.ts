import { Injectable } from '@nestjs/common';
import {
  ReportDebtRecoveryRaw,
  ReportProfitLine,
  ReportSaleRow,
  ReportSellerRow,
  ReportTopProductRow,
} from '../entities/report.entity';

export interface ReportSalesKpis {
  grossRevenue: number;
  collectedRevenue: number;
  creditGranted: number;
  saleCount: number;
  averageBasket: number;
  totalCash: number;
  totalMomo: number;
  totalCredit: number;
}

export interface ReportFinancialKpis {
  estimatedProfit: number | null;
  profitAvailable: boolean;
  profitWarning: string | null;
  recoveryRate: number | null;
  recoveryRateAvailable: boolean;
  debtsCreatedAmount: number;
  debtsRepaidAmount: number;
}

@Injectable()
export class ReportAggregationService {
  aggregateSales(sales: ReportSaleRow[]): ReportSalesKpis {
    if (sales.length === 0) {
      return {
        grossRevenue: 0,
        collectedRevenue: 0,
        creditGranted: 0,
        saleCount: 0,
        averageBasket: 0,
        totalCash: 0,
        totalMomo: 0,
        totalCredit: 0,
      };
    }

    const totals = sales.reduce(
      (acc, sale) => ({
        grossRevenue: acc.grossRevenue + sale.totalAmount,
        collectedRevenue: acc.collectedRevenue + sale.amountCash + sale.amountMomo,
        creditGranted: acc.creditGranted + sale.amountCredit,
        totalCash: acc.totalCash + sale.amountCash,
        totalMomo: acc.totalMomo + sale.amountMomo,
        totalCredit: acc.totalCredit + sale.amountCredit,
        saleCount: acc.saleCount + 1,
      }),
      {
        grossRevenue: 0,
        collectedRevenue: 0,
        creditGranted: 0,
        totalCash: 0,
        totalMomo: 0,
        totalCredit: 0,
        saleCount: 0,
      },
    );

    return {
      ...totals,
      averageBasket: Math.round(totals.grossRevenue / totals.saleCount),
    };
  }

  aggregateFinancial(
    profitLines: ReportProfitLine[],
    debtRecovery: ReportDebtRecoveryRaw,
  ): ReportFinancialKpis {
    const hasCostData = profitLines.some((line) => line.unitCost !== null && line.unitCost > 0);

    let estimatedProfit: number | null = null;
    let profitWarning: string | null = null;

    if (!hasCostData) {
      profitWarning =
        'Bénéfice indisponible : renseignez le prix d\'achat sur les produits vendus sur la période.';
    } else {
      estimatedProfit = profitLines.reduce((sum, line) => {
        if (line.unitCost === null) return sum;
        const margin = line.unitPrice - line.unitCost;
        return sum + Math.round(margin * line.quantity);
      }, 0);
    }

    const { debtsCreatedAmount, debtsRepaidAmount } = debtRecovery;
    let recoveryRate: number | null = null;
    let recoveryRateAvailable = false;

    if (debtsCreatedAmount > 0) {
      recoveryRate = Math.round((debtsRepaidAmount / debtsCreatedAmount) * 100);
      recoveryRateAvailable = true;
    }

    return {
      estimatedProfit,
      profitAvailable: hasCostData,
      profitWarning,
      recoveryRate,
      recoveryRateAvailable,
      debtsCreatedAmount,
      debtsRepaidAmount,
    };
  }

  sortTopProducts(
    products: ReportTopProductRow[],
    sortBy: 'quantity' | 'revenue',
    limit: number,
  ): ReportTopProductRow[] {
    return [...products]
      .sort((a, b) =>
        sortBy === 'revenue' ? b.revenue - a.revenue : b.quantitySold - a.quantitySold,
      )
      .slice(0, limit);
  }

  aggregateSellerPerformance(sellers: ReportSellerRow[]): ReportSellerRow[] {
    return [...sellers].sort((a, b) => b.totalRevenue - a.totalRevenue);
  }
}
