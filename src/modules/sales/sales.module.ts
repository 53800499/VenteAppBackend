import { Module, forwardRef } from '@nestjs/common';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import {
  CancelSaleUseCase,
  CreateQuickSaleUseCase,
  CreateStandardSaleUseCase,
  GetSaleUseCase,
  ListSalesUseCase,
} from './application/use-cases/sale.use-cases';
import {
  SaleCustomerRepository,
  SaleDebtRepository,
  SaleRepository,
} from './domain/repositories/sale.repository';
import { ReceiptNumberService } from './domain/services/receipt-number.service';
import { SaleValidationService } from './domain/services/sale-validation.service';
import { SupabaseSaleCustomerRepository } from './infrastructure/repositories/customer.repository';
import { SupabaseSaleDebtRepository } from './infrastructure/repositories/debt.repository';
import { SupabaseSaleRepository } from './infrastructure/repositories/sale.repository';
import { SalesController } from './presentation/controllers/sales.controller';

@Module({
  imports: [
    AuthorizationGuardsModule,
    AuditModule,
    InventoryModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [SalesController],
  providers: [
    { provide: SaleRepository, useClass: SupabaseSaleRepository },
    { provide: SaleCustomerRepository, useClass: SupabaseSaleCustomerRepository },
    { provide: SaleDebtRepository, useClass: SupabaseSaleDebtRepository },
    SaleValidationService,
    ReceiptNumberService,
    CreateStandardSaleUseCase,
    CreateQuickSaleUseCase,
    ListSalesUseCase,
    GetSaleUseCase,
    CancelSaleUseCase,
  ],
  exports: [SaleRepository],
})
export class SalesModule {}
