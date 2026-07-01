import { ReportPeriodData } from '../entities/report.entity';

export interface ReportLoadParams {
  shopIds: number[];
  fromMs: number;
  toMs: number;
  topProductsLimit?: number;
  includeSellerPerformance?: boolean;
}

export abstract class ReportReadRepository {
  abstract loadPeriodData(params: ReportLoadParams): Promise<ReportPeriodData>;
}
