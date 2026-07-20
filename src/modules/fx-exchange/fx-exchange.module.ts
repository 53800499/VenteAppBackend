import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import { FxCalculationService } from './domain/services/fx-calculation.service';
import { FxExchangeRepository } from './domain/repositories/fx-exchange.repository';
import { SupabaseFxExchangeRepository } from './infrastructure/repositories/fx-exchange.repository';
import { FxExchangeController } from './presentation/controllers/fx-exchange.controller';
import {
  CloseFxSessionUseCase,
  ConfirmFxSessionCloseUseCase,
  CancelFxPendingCloseUseCase,
  CreateFxMovementUseCase,
  CreateFxOperationUseCase,
  CreateFxRateUseCase,
  FxExchangeGuardService,
  GetFxDailyReportUseCase,
  GetFxModuleStatusUseCase,
  GetOpenFxSessionUseCase,
  ListFxCurrenciesUseCase,
  ListFxMovementsUseCase,
  ListFxOperationsUseCase,
  ListFxRateHistoryUseCase,
  ListFxRatesUseCase,
  ListFxSessionsUseCase,
  OpenFxSessionUseCase,
  PreviewFxOperationUseCase,
  ToggleFxModuleUseCase,
  UpsertFxShopCurrenciesUseCase,
} from './application/use-cases/fx-exchange.use-cases';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [FxExchangeController],
  providers: [
    { provide: FxExchangeRepository, useClass: SupabaseFxExchangeRepository },
    FxCalculationService,
    FxExchangeGuardService,
    GetFxModuleStatusUseCase,
    ToggleFxModuleUseCase,
    ListFxCurrenciesUseCase,
    UpsertFxShopCurrenciesUseCase,
    CreateFxRateUseCase,
    ListFxRatesUseCase,
    ListFxRateHistoryUseCase,
    ListFxSessionsUseCase,
    GetOpenFxSessionUseCase,
    OpenFxSessionUseCase,
    CloseFxSessionUseCase,
    ConfirmFxSessionCloseUseCase,
    CancelFxPendingCloseUseCase,
    CreateFxOperationUseCase,
    PreviewFxOperationUseCase,
    ListFxOperationsUseCase,
    CreateFxMovementUseCase,
    ListFxMovementsUseCase,
    GetFxDailyReportUseCase,
  ],
  exports: [FxExchangeRepository],
})
export class FxExchangeModule {}
