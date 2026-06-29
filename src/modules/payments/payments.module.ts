import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GetPaymentUseCase, ListPaymentsUseCase } from './application/use-cases/payment.use-cases';
import { PaymentRepository } from './domain/repositories/payment.repository';
import { PaymentReceiptService } from './domain/services/payment-receipt.service';
import { SupabasePaymentRepository } from './infrastructure/repositories/payment.repository';
import { PaymentsController } from './presentation/controllers/payments.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [PaymentsController],
  providers: [
    { provide: PaymentRepository, useClass: SupabasePaymentRepository },
    PaymentReceiptService,
    ListPaymentsUseCase,
    GetPaymentUseCase,
  ],
  exports: [PaymentRepository, PaymentReceiptService],
})
export class PaymentsModule {}
