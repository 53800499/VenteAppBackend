import { BadRequestException, Injectable } from '@nestjs/common';
import { Permission } from '../../../../shared/enums/permission.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import {
  ReportPeriodPreset,
  resolveReportPeriod,
} from '../../../../shared/utils/benin-period-range.util';
import { SalesAnalysisReadRepository } from '../../domain/repositories/sales-analysis-read.repository';
import { SalesAnalysisAggregationService } from '../../domain/services/sales-analysis-aggregation.service';

const EMPTY_MESSAGE = 'Aucune vente sur cette période.';

@Injectable()
export class GetSalesAnalysisUseCase {
  constructor(
    private readonly repository: SalesAnalysisReadRepository,
    private readonly aggregation: SalesAnalysisAggregationService,
  ) {}

  async execute(
    auth: AuthContext,
    query: {
      period?: ReportPeriodPreset;
      from?: number;
      to?: number;
      marginTopLimit?: number;
    },
  ) {
    const preset = query.period ?? 'month';
    let periodRange;
    try {
      periodRange = resolveReportPeriod(preset, Date.now(), query.from, query.to);
    } catch {
      throw new BadRequestException('Période invalide : précisez from et to pour period=custom.');
    }

    const shopIds = [auth.shopId];
    const raw = await this.repository.loadPeriodData({
      shopIds,
      fromMs: periodRange.fromMs,
      toMs: periodRange.toMs,
    });

    const empty = raw.sales.length === 0 && raw.items.length === 0;
    const canViewFinancial = auth.permissions.includes(Permission.REPORTS_FINANCIAL);

    const categories = empty ? [] : this.aggregation.aggregateCategories(raw.items);
    const margins = canViewFinancial
      ? this.aggregation.aggregateMargins(raw.items, query.marginTopLimit ?? 15)
      : undefined;
    const priceDeviations = empty
      ? []
      : this.aggregation.aggregatePriceDeviations(raw.items);
    const trends = empty
      ? { points: [], totalRevenue: 0, totalSaleCount: 0 }
      : this.aggregation.aggregateTrends(raw.sales, raw.items);

    return {
      shopId: auth.shopId,
      period: {
        preset: periodRange.preset,
        label: periodRange.label,
        fromMs: periodRange.fromMs,
        toMs: periodRange.toMs,
      },
      empty,
      emptyMessage: empty ? EMPTY_MESSAGE : null,
      categories,
      margins,
      priceDeviations,
      trends,
      generatedAt: Date.now(),
    };
  }
}
