import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { SalesOrdersRepository } from './domain/repositories/sales-orders.repository';
import { SupabaseSalesOrdersRepository } from './infrastructure/repositories/supabase-sales-orders.repository';
import { SalesOrdersController } from './presentation/controllers/sales-orders.controller';
import {
  CancelSalesOrderUseCase,
  CloseSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  DeliverSalesOrderUseCase,
  GetSalesOrderUseCase,
  ListSalesOrdersUseCase,
  PrepareSalesOrderUseCase,
} from './application/use-cases/sales-orders.use-cases';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    ShopsModule,
    TenantsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [SalesOrdersController],
  providers: [
    {
      provide: SalesOrdersRepository,
      useClass: SupabaseSalesOrdersRepository,
    },
    ListSalesOrdersUseCase,
    GetSalesOrderUseCase,
    CreateSalesOrderUseCase,
    ConfirmSalesOrderUseCase,
    PrepareSalesOrderUseCase,
    DeliverSalesOrderUseCase,
    CancelSalesOrderUseCase,
    CloseSalesOrderUseCase,
  ],
  exports: [SalesOrdersRepository],
})
export class SalesOrdersModule {}
