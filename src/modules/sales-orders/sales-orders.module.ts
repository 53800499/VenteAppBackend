import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { SalesOrdersRepository } from './domain/repositories/sales-orders.repository';
import { InMemorySalesOrdersRepository } from './infrastructure/repositories/in-memory-sales-orders.repository';
import { SalesOrdersController } from './presentation/controllers/sales-orders.controller';
import {
  CancelSalesOrderUseCase,
  CloseSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  DeliverSalesOrderUseCase,
  GetSalesOrderUseCase,
  ListSalesOrdersUseCase,
} from './application/use-cases/sales-orders.use-cases';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [SalesOrdersController],
  providers: [
    { provide: SalesOrdersRepository, useClass: InMemorySalesOrdersRepository },
    ListSalesOrdersUseCase,
    GetSalesOrderUseCase,
    CreateSalesOrderUseCase,
    ConfirmSalesOrderUseCase,
    DeliverSalesOrderUseCase,
    CancelSalesOrderUseCase,
    CloseSalesOrderUseCase,
  ],
  exports: [SalesOrdersRepository],
})
export class SalesOrdersModule {}
