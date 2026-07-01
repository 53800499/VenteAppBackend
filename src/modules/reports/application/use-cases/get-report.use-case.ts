import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Permission } from '../../../../shared/enums/permission.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import {
  ReportPeriodPreset,
  resolveReportPeriod,
} from '../../../../shared/utils/benin-period-range.util';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { ReportReadRepository } from '../../domain/repositories/report-read.repository';
import { ReportAggregationService } from '../../domain/services/report-aggregation.service';

const EMPTY_MESSAGE = 'Aucune vente sur cette période.';

@Injectable()
export class GetReportUseCase {
  constructor(
    private readonly reports: ReportReadRepository,
    private readonly aggregation: ReportAggregationService,
    private readonly shops: ShopRepository,
  ) {}

  async execute(
    auth: AuthContext,
    query: {
      period?: ReportPeriodPreset;
      from?: number;
      to?: number;
      consolidated?: boolean;
      topBy?: 'quantity' | 'revenue';
      topLimit?: number;
    },
  ) {
    const preset = query.period ?? 'month';
    let periodRange;
    try {
      periodRange = resolveReportPeriod(preset, Date.now(), query.from, query.to);
    } catch {
      throw new BadRequestException('Période invalide : précisez from et to pour period=custom.');
    }

    const consolidated = query.consolidated === true;
    const shopIds = await this.resolveShopIds(auth, consolidated);

    const canViewFinancial = auth.permissions.includes(Permission.REPORTS_FINANCIAL);
    const includeSellerPerformance = auth.permissions.includes(Permission.REPORTS_READ);

    const raw = await this.reports.loadPeriodData({
      shopIds,
      fromMs: periodRange.fromMs,
      toMs: periodRange.toMs,
      includeSellerPerformance,
    });

    const salesKpis = this.aggregation.aggregateSales(raw.sales);
    const empty = salesKpis.saleCount === 0;

    const topLimit = query.topLimit ?? 10;
    const topSorted = this.aggregation
      .sortTopProducts(raw.topProducts, query.topBy ?? 'quantity', topLimit)
      .map((p, index) => ({
        rank: index + 1,
        productId: p.productId,
        productName: p.productName,
        quantitySold: p.quantitySold,
        revenue: p.revenue,
      }));

    const financial = canViewFinancial
      ? this.aggregation.aggregateFinancial(raw.profitLines, raw.debtRecovery)
      : undefined;

    const sellerPerformance =
      includeSellerPerformance && raw.sellerPerformance.length > 0
        ? this.aggregation.aggregateSellerPerformance(raw.sellerPerformance).map((s) => ({
            userId: s.userId,
            userName: s.userName,
            saleCount: s.saleCount,
            totalRevenue: s.totalRevenue,
          }))
        : undefined;

    return {
      shopId: consolidated ? null : auth.shopId,
      shopIds,
      consolidated,
      period: {
        preset: periodRange.preset,
        label: periodRange.label,
        fromMs: periodRange.fromMs,
        toMs: periodRange.toMs,
      },
      empty,
      emptyMessage: empty ? EMPTY_MESSAGE : null,
      sales: salesKpis,
      financial,
      topProducts: empty ? [] : topSorted,
      sellerPerformance: empty ? [] : sellerPerformance,
      generatedAt: Date.now(),
    };
  }

  private async resolveShopIds(auth: AuthContext, consolidated: boolean): Promise<number[]> {
    if (!consolidated) {
      return [auth.shopId];
    }

    if (auth.role !== UserRole.OWNER) {
      throw new ForbiddenException('La vue consolidée est réservée au patron.');
    }
    if (!auth.permissions.includes(Permission.SHOPS_CONSOLIDATED_READ)) {
      throw new ForbiddenException('Permission shops:consolidated_read requise.');
    }

    const owned = await this.shops.findByOwnerUserId(auth.userId);
    const activeIds = owned.filter((s) => s.isActive).map((s) => s.id);
    if (activeIds.length === 0) {
      return [auth.shopId];
    }
    return activeIds;
  }
}
