import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import {
  ApproveCashSessionUseCase,
  CloseCashSessionUseCase,
  CreateCashMovementUseCase,
  ListCashMovementsUseCase,
  ListCashSessionsUseCase,
  OpenCashSessionUseCase,
  RecordOwnerDropUseCase,
  ReopenCashSessionUseCase,
  SubmitCashSessionClosingUseCase,
} from './application/use-cases/cash-session.use-cases';
import { CashSessionRepository } from './domain/repositories/cash-session.repository';
import { CashSessionValidationService } from './domain/services/cash-session-validation.service';
import { SupabaseCashSessionRepository } from './infrastructure/repositories/cash-session.repository';
import { CashSessionsController } from './presentation/controllers/cash-sessions.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [CashSessionsController],
  providers: [
    { provide: CashSessionRepository, useClass: SupabaseCashSessionRepository },
    CashSessionValidationService,
    ListCashSessionsUseCase,
    ListCashMovementsUseCase,
    OpenCashSessionUseCase,
    CreateCashMovementUseCase,
    RecordOwnerDropUseCase,
    SubmitCashSessionClosingUseCase,
    ApproveCashSessionUseCase,
    ReopenCashSessionUseCase,
    CloseCashSessionUseCase,
  ],
  exports: [CashSessionRepository],
})
export class CashSessionsModule {}
