import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import {
  ForgiveDebtUseCase,
  GetDebtHistoryUseCase,
  GetDebtUseCase,
  GetDebtsSummaryUseCase,
  ListDebtsUseCase,
  RecordDebtPaymentUseCase,
} from './application/use-cases/debt.use-cases';
import { DebtRepository } from './domain/repositories/debt.repository';
import { DebtValidationService } from './domain/services/debt-validation.service';
import { SupabaseDebtRepository } from './infrastructure/repositories/debt.repository';
import { DebtsController } from './presentation/controllers/debts.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    AuditModule,
    PaymentsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [DebtsController],
  providers: [
    { provide: DebtRepository, useClass: SupabaseDebtRepository },
    DebtValidationService,
    GetDebtsSummaryUseCase,
    ListDebtsUseCase,
    GetDebtUseCase,
    GetDebtHistoryUseCase,
    RecordDebtPaymentUseCase,
    ForgiveDebtUseCase,
  ],
  exports: [DebtRepository],
})
export class DebtsModule {}
