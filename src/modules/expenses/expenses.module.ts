import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { UsersModule } from '../users/users.module';
import {
  CreateExpenseCategoryUseCase,
  CreateExpenseUseCase,
  DeleteExpenseUseCase,
  GenerateRecurringExpensesUseCase,
  GetExpenseHistoryUseCase,
  GetExpenseProfitUseCase,
  GetExpenseUseCase,
  GetExpensesByCategoryUseCase,
  GetExpensesSummaryUseCase,
  ListExpenseCategoriesUseCase,
  ListExpensesUseCase,
  UpdateExpenseCategoryUseCase,
  UpdateExpenseUseCase,
  UpsertCategoryBudgetUseCase,
} from './application/use-cases/expense.use-cases';
import { ExpenseRepository } from './domain/repositories/expense.repository';
import { ExpenseValidationService } from './domain/services/expense-validation.service';
import { SupabaseExpenseRepository } from './infrastructure/repositories/expense.repository';
import { ExpensesController } from './presentation/controllers/expenses.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    ReportsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [ExpensesController],
  providers: [
    { provide: ExpenseRepository, useClass: SupabaseExpenseRepository },
    ExpenseValidationService,
    ListExpenseCategoriesUseCase,
    CreateExpenseCategoryUseCase,
    UpdateExpenseCategoryUseCase,
    ListExpensesUseCase,
    GetExpenseUseCase,
    GetExpenseHistoryUseCase,
    CreateExpenseUseCase,
    UpdateExpenseUseCase,
    DeleteExpenseUseCase,
    GetExpensesSummaryUseCase,
    GetExpensesByCategoryUseCase,
    UpsertCategoryBudgetUseCase,
    GetExpenseProfitUseCase,
    GenerateRecurringExpensesUseCase,
  ],
  exports: [ExpenseRepository],
})
export class ExpensesModule {}
