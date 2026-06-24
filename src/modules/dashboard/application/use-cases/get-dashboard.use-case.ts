import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Permission } from '../../../../shared/enums/permission.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { getBeninDayBounds } from '../../../../shared/utils/benin-day-range.util';
import { TodaySaleRow } from '../../domain/entities/dashboard.entity';
import { DashboardReadRepository } from '../../domain/repositories/dashboard-read.repository';
import { DashboardAggregationService } from '../../domain/services/dashboard-aggregation.service';

const RECENT_SALES_LIMIT = 5;

@Injectable()
export class GetDashboardUseCase {
  constructor(
    private readonly dashboardRead: DashboardReadRepository,
    private readonly aggregation: DashboardAggregationService,
    private readonly configService: ConfigService,
  ) {}

  async execute(auth: AuthContext) {
    const range = getBeninDayBounds();

    const defaultThreshold = this.configService.get<number>(
      'dashboard.defaultAlertThreshold',
      5,
    );

    const raw = await this.dashboardRead.loadSummary(
      auth.shopId,
      range,
      defaultThreshold,
      RECENT_SALES_LIMIT,
    );

    const salesStats = this.aggregation.aggregateSales(raw.sales);
    const publicKpis = this.aggregation.toPublicKpis(
      salesStats,
      raw.lowStockCount,
      raw.debts.debtorCount,
    );

    const canViewFinancial = auth.permissions.includes(Permission.DASHBOARD_FINANCIAL);
    const financial = canViewFinancial
      ? this.aggregation.aggregateFinancial(salesStats, raw.profitLines, raw.debts)
      : undefined;

    const date = this.formatBeninDate(range.dayEndMs);

    return {
      shopId: auth.shopId,
      date,
      kpis: publicKpis,
      financial,
      recentSales: raw.recentSales.map((sale) => this.toRecentSaleDto(sale)),
      generatedAt: Date.now(),
    };
  }

  private toRecentSaleDto(sale: TodaySaleRow) {
    return {
      id: sale.id,
      totalAmount: sale.totalAmount,
      createdAt: sale.createdAt,
      customerName: sale.customerName,
      paymentMode: this.resolvePaymentMode(sale),
    };
  }

  private resolvePaymentMode(sale: TodaySaleRow): string {
    if (sale.amountCredit > 0 && sale.amountCash === 0 && sale.amountMomo === 0) {
      return 'credit';
    }
    if (sale.amountCredit > 0) return 'mixed';
    if (sale.amountMomo > 0 && sale.amountCash === 0) return 'momo';
    if (sale.amountMomo > 0) return 'mixed';
    return 'cash';
  }

  private formatBeninDate(nowMs: number): string {
    const BENIN_OFFSET_MS = 60 * 60 * 1000;
    const local = new Date(nowMs + BENIN_OFFSET_MS);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, '0');
    const d = String(local.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
