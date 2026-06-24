import { Injectable } from '@nestjs/common';
import {
  DashboardDebtStats,
  DashboardSalesStats,
  SaleProfitRow,
  TodaySaleRow,
} from '../entities/dashboard.entity';

export interface DashboardFinancialKpis {
  totalCash: number;
  totalMomo: number;
  totalCredit: number;
  estimatedProfit: number | null;
  profitAvailable: boolean;
  profitWarning: string | null;
  totalDebt: number;
}

export interface DashboardPublicKpis {
  totalRevenue: number;
  saleCount: number;
  lowStockCount: number;
  debtorCount: number;
}

@Injectable()
export class DashboardAggregationService {
  aggregateSales(sales: TodaySaleRow[]): DashboardSalesStats {
    if (sales.length === 0) {
      return {
        totalRevenue: 0,
        saleCount: 0,
        totalCash: 0,
        totalMomo: 0,
        totalCredit: 0,
      };
    }

    return sales.reduce(
      (acc, sale) => ({
        totalRevenue: acc.totalRevenue + sale.totalAmount,
        saleCount: acc.saleCount + 1,
        totalCash: acc.totalCash + sale.amountCash,
        totalMomo: acc.totalMomo + sale.amountMomo,
        totalCredit: acc.totalCredit + sale.amountCredit,
      }),
      {
        totalRevenue: 0,
        saleCount: 0,
        totalCash: 0,
        totalMomo: 0,
        totalCredit: 0,
      },
    );
  }

  aggregateFinancial(
    salesStats: DashboardSalesStats,
    profitLines: SaleProfitRow[],
    debts: DashboardDebtStats,
  ): DashboardFinancialKpis {
    const hasCostData = profitLines.some((line) => line.unitCost !== null && line.unitCost > 0);

    let estimatedProfit: number | null = null;
    let profitWarning: string | null = null;

    if (!hasCostData) {
      profitWarning =
        'Bénéfice indisponible : renseignez le prix d\'achat sur les produits vendus aujourd\'hui.';
    } else {
      estimatedProfit = profitLines.reduce((sum, line) => {
        if (line.unitCost === null) return sum;
        const margin = line.unitPrice - line.unitCost;
        return sum + Math.round(margin * line.quantity);
      }, 0);
    }

    return {
      totalCash: salesStats.totalCash,
      totalMomo: salesStats.totalMomo,
      totalCredit: salesStats.totalCredit,
      estimatedProfit,
      profitAvailable: hasCostData,
      profitWarning,
      totalDebt: debts.totalDebt,
    };
  }

  toPublicKpis(
    salesStats: DashboardSalesStats,
    lowStockCount: number,
    debtorCount: number,
  ): DashboardPublicKpis {
    return {
      totalRevenue: salesStats.totalRevenue,
      saleCount: salesStats.saleCount,
      lowStockCount,
      debtorCount,
    };
  }
}
