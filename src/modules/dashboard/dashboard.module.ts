import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import { GetDashboardUseCase } from './application/use-cases/get-dashboard.use-case';
import { DashboardReadRepository } from './domain/repositories/dashboard-read.repository';
import { DashboardAggregationService } from './domain/services/dashboard-aggregation.service';
import { SupabaseDashboardReadRepository } from './infrastructure/repositories/dashboard-read.repository';
import { DashboardController } from './presentation/controllers/dashboard.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [DashboardController],
  providers: [
    { provide: DashboardReadRepository, useClass: SupabaseDashboardReadRepository },
    DashboardAggregationService,
    GetDashboardUseCase,
  ],
})
export class DashboardModule {}
