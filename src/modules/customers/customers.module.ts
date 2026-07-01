import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditPersistenceModule } from '../audit/audit-persistence.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import {
  ArchiveCustomerUseCase,
  CreateCustomerUseCase,
  GetCustomerUseCase,
  GetDebtReminderUseCase,
  ListCustomerSalesUseCase,
  ListCustomersUseCase,
  ListDebtorsUseCase,
  UpdateCustomerUseCase,
} from './application/use-cases/customer.use-cases';
import { CustomerRepository } from './domain/repositories/customer.repository';
import { CustomerValidationService } from './domain/services/customer-validation.service';
import { SupabaseCustomerRepository } from './infrastructure/repositories/customer.repository';
import { CustomersController } from './presentation/controllers/customers.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    AuditPersistenceModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [CustomersController],
  providers: [
    { provide: CustomerRepository, useClass: SupabaseCustomerRepository },
    CustomerValidationService,
    ListCustomersUseCase,
    ListDebtorsUseCase,
    GetCustomerUseCase,
    ListCustomerSalesUseCase,
    CreateCustomerUseCase,
    UpdateCustomerUseCase,
    ArchiveCustomerUseCase,
    GetDebtReminderUseCase,
  ],
  exports: [CustomerRepository],
})
export class CustomersModule {}
