import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import {
  ForgiveDebtUseCase,
  GetDebtUseCase,
  ListDebtsUseCase,
  RecordDebtPaymentUseCase,
} from './application/use-cases/debt.use-cases';
import { GetPaymentUseCase, ListPaymentsUseCase } from './application/use-cases/payment.use-cases';
import { DebtRepository } from './domain/repositories/debt.repository';
import { PaymentRepository } from './domain/repositories/payment.repository';
import { PaymentReceiptService } from './domain/services/payment-receipt.service';
import { PaymentValidationService } from './domain/services/payment-validation.service';
import { SupabaseDebtRepository } from './infrastructure/repositories/debt.repository';
import { SupabasePaymentRepository } from './infrastructure/repositories/payment.repository';
import { DebtsController } from './presentation/controllers/debts.controller';
import { PaymentsController } from './presentation/controllers/payments.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    AuditModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [DebtsController, PaymentsController],
  providers: [
    { provide: PaymentRepository, useClass: SupabasePaymentRepository },
    { provide: DebtRepository, useClass: SupabaseDebtRepository },
    PaymentValidationService,
    PaymentReceiptService,
    ListDebtsUseCase,
    GetDebtUseCase,
    RecordDebtPaymentUseCase,
    ForgiveDebtUseCase,
    ListPaymentsUseCase,
    GetPaymentUseCase,
  ],
  exports: [PaymentRepository, DebtRepository],
})
export class PaymentsModule {}
