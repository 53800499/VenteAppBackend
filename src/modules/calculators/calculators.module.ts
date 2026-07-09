import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import { CalculatorsController } from './presentation/controllers/calculators.controller';
import { CalculatorsRepository } from './domain/repositories/calculators.repository';
import { SupabaseCalculatorsRepository } from './infrastructure/repositories/supabase-calculators.repository';
import {
  GetCalculatorsStatusUseCase,
  ToggleCalculatorsUseCase,
  ListCalculatorProductsUseCase,
  UpsertCalculatorProductUseCase,
  ListCalculatorHistoryUseCase,
  CreateCalculatorHistoryUseCase,
} from './application/use-cases/calculators.use-cases';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [CalculatorsController],
  providers: [
    { provide: CalculatorsRepository, useClass: SupabaseCalculatorsRepository },
    GetCalculatorsStatusUseCase,
    ToggleCalculatorsUseCase,
    ListCalculatorProductsUseCase,
    UpsertCalculatorProductUseCase,
    ListCalculatorHistoryUseCase,
    CreateCalculatorHistoryUseCase,
  ],
  exports: [CalculatorsRepository],
})
export class CalculatorsModule {}
