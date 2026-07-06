import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import { GetSalesAnalysisUseCase } from './application/use-cases/get-sales-analysis.use-case';
import { SalesAnalysisReadRepository } from './domain/repositories/sales-analysis-read.repository';
import { SalesAnalysisAggregationService } from './domain/services/sales-analysis-aggregation.service';
import { SupabaseSalesAnalysisReadRepository } from './infrastructure/repositories/sales-analysis-read.repository';
import { SalesAnalysisController } from './presentation/controllers/sales-analysis.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [SalesAnalysisController],
  providers: [
    {
      provide: SalesAnalysisReadRepository,
      useClass: SupabaseSalesAnalysisReadRepository,
    },
    SalesAnalysisAggregationService,
    GetSalesAnalysisUseCase,
  ],
})
export class SalesAnalysisModule {}
