import { SalesAnalysisPeriodData } from '../entities/sales-analysis.entity';

export interface SalesAnalysisLoadParams {
  shopIds: number[];
  fromMs: number;
  toMs: number;
}

export abstract class SalesAnalysisReadRepository {
  abstract loadPeriodData(params: SalesAnalysisLoadParams): Promise<SalesAnalysisPeriodData>;
}
