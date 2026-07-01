import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import { GetReportUseCase } from './application/use-cases/get-report.use-case';
import { ReportReadRepository } from './domain/repositories/report-read.repository';
import { ReportAggregationService } from './domain/services/report-aggregation.service';
import { SupabaseReportReadRepository } from './infrastructure/repositories/report-read.repository';
import { ReportsController } from './presentation/controllers/reports.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [ReportsController],
  providers: [
    { provide: ReportReadRepository, useClass: SupabaseReportReadRepository },
    ReportAggregationService,
    GetReportUseCase,
  ],
})
export class ReportsModule {}
