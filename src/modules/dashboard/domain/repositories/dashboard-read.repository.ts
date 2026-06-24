import { DashboardSummaryRaw } from '../entities/dashboard.entity';

export interface DashboardDayRange {
  dayStartMs: number;
  dayEndMs: number;
}

export abstract class DashboardReadRepository {
  abstract loadSummary(
    shopId: number,
    range: DashboardDayRange,
    defaultAlertThreshold: number,
    recentLimit: number,
  ): Promise<DashboardSummaryRaw>;
}
