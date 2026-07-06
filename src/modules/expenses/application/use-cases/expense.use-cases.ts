import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission } from '../../../../shared/enums/permission.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import {
  ReportPeriodPreset,
  beninDayStart,
  beninMonthStartMs,
  resolveReportPeriod,
} from '../../../../shared/utils/benin-period-range.util';
import { ReportReadRepository } from '../../../reports/domain/repositories/report-read.repository';
import { ReportAggregationService } from '../../../reports/domain/services/report-aggregation.service';
import { Expense } from '../../domain/entities/expense.entity';
import { ExpenseRepository } from '../../domain/repositories/expense.repository';
import { ExpenseValidationService } from '../../domain/services/expense-validation.service';
import {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  GetExpenseProfitQueryDto,
  ListExpensesQueryDto,
  UpdateExpenseCategoryDto,
  UpdateExpenseDto,
  UpsertCategoryBudgetDto,
} from '../dto/expense.dto';

@Injectable()
export class ListExpenseCategoriesUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  execute(auth: AuthContext) {
    return this.expenses.listCategories(auth.shopId);
  }
}

@Injectable()
export class CreateExpenseCategoryUseCase {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly validation: ExpenseValidationService,
  ) {}

  execute(auth: AuthContext, dto: CreateExpenseCategoryDto) {
    return this.expenses.createCategory(auth.shopId, {
      name: this.validation.assertCategoryName(dto.name),
      color: dto.color ?? null,
      icon: dto.icon ?? null,
    });
  }
}

@Injectable()
export class UpdateExpenseCategoryUseCase {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly validation: ExpenseValidationService,
  ) {}

  execute(auth: AuthContext, categoryId: number, dto: UpdateExpenseCategoryDto) {
    return this.expenses.updateCategory(auth.shopId, categoryId, {
      ...(dto.name != null ? { name: this.validation.assertCategoryName(dto.name) } : {}),
      ...(dto.color !== undefined ? { color: dto.color ?? null } : {}),
      ...(dto.icon !== undefined ? { icon: dto.icon ?? null } : {}),
    });
  }
}

@Injectable()
export class ListExpensesUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  execute(auth: AuthContext, query: ListExpensesQueryDto) {
    return this.expenses.listExpenses(auth.shopId, {
      fromMs: query.from,
      toMs: query.to,
      categoryId: query.categoryId,
      createdBy: query.createdBy,
      paymentMethod: query.paymentMethod,
      status: query.status,
      search: query.search,
    });
  }
}

@Injectable()
export class GetExpenseUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  async execute(auth: AuthContext, expenseId: number) {
    const expense = await this.expenses.findExpense(auth.shopId, expenseId);
    if (!expense) throw new NotFoundException('Dépense introuvable.');
    return expense;
  }
}

@Injectable()
export class GetExpenseHistoryUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  async execute(auth: AuthContext, expenseId: number) {
    const expense = await this.expenses.findExpense(auth.shopId, expenseId);
    if (!expense) throw new NotFoundException('Dépense introuvable.');
    return this.expenses.listHistory(auth.shopId, expenseId);
  }
}

@Injectable()
export class CreateExpenseUseCase {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly validation: ExpenseValidationService,
  ) {}

  execute(auth: AuthContext, dto: CreateExpenseDto) {
    this.validation.assertAmount(dto.amount);
    return this.expenses.createExpense(auth.shopId, {
      categoryId: dto.categoryId ?? null,
      title: this.validation.assertTitle(dto.title),
      description: dto.description ?? null,
      amount: dto.amount,
      expenseDate: dto.expenseDate,
      paymentMethod: this.validation.assertPaymentMethod(dto.paymentMethod),
      createdBy: auth.userId,
      supplier: dto.supplier ?? null,
      invoiceNumber: dto.invoiceNumber ?? null,
      repeatSchedule: dto.repeatSchedule
        ? this.validation.assertRepeatSchedule(dto.repeatSchedule)
        : 'none',
      status: dto.status ? this.validation.assertStatus(dto.status) : 'validated',
    });
  }
}

@Injectable()
export class UpdateExpenseUseCase {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly validation: ExpenseValidationService,
  ) {}

  async execute(auth: AuthContext, expenseId: number, dto: UpdateExpenseDto) {
    if (dto.amount != null) this.validation.assertAmount(dto.amount);
    return this.expenses.updateExpense(
      auth.shopId,
      expenseId,
      {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId ?? null } : {}),
        ...(dto.title != null ? { title: this.validation.assertTitle(dto.title) } : {}),
        ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
        ...(dto.amount != null ? { amount: dto.amount } : {}),
        ...(dto.expenseDate != null ? { expenseDate: dto.expenseDate } : {}),
        ...(dto.paymentMethod != null
          ? { paymentMethod: this.validation.assertPaymentMethod(dto.paymentMethod) }
          : {}),
        ...(dto.supplier !== undefined ? { supplier: dto.supplier ?? null } : {}),
        ...(dto.invoiceNumber !== undefined ? { invoiceNumber: dto.invoiceNumber ?? null } : {}),
        ...(dto.repeatSchedule != null
          ? { repeatSchedule: this.validation.assertRepeatSchedule(dto.repeatSchedule) }
          : {}),
        ...(dto.status != null ? { status: this.validation.assertStatus(dto.status) } : {}),
      },
      auth.userId,
    );
  }
}

@Injectable()
export class DeleteExpenseUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  async execute(auth: AuthContext, expenseId: number) {
    await this.expenses.softDeleteExpense(auth.shopId, expenseId, auth.userId);
    return { success: true };
  }
}

@Injectable()
export class GetExpensesSummaryUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  async execute(auth: AuthContext) {
    const now = Date.now();
    const dayStart = beninDayStart(now);
    const weekStart = dayStart - 6 * 86_400_000;
    const monthStart = beninMonthStartMs(now);

    const [todayTotal, weekTotal, monthTotal, todayExpenses, todayList] = await Promise.all([
      this.expenses.sumValidatedExpenses(auth.shopId, dayStart, now),
      this.expenses.sumValidatedExpenses(auth.shopId, weekStart, now),
      this.expenses.sumValidatedExpenses(auth.shopId, monthStart, now),
      this.expenses.sumValidatedExpensesByMethod(auth.shopId, dayStart, now, [
        'cash',
        'mtn_momo',
        'moov_money',
      ]),
      this.expenses.listExpenses(auth.shopId, { fromMs: dayStart, toMs: now, status: 'validated' }),
    ]);

    return {
      today: { expenseCount: todayList.length, totalAmount: todayTotal },
      week: {
        expenseCount: (
          await this.expenses.listExpenses(auth.shopId, {
            fromMs: weekStart,
            toMs: now,
            status: 'validated',
          })
        ).length,
        totalAmount: weekTotal,
      },
      month: {
        expenseCount: (
          await this.expenses.listExpenses(auth.shopId, {
            fromMs: monthStart,
            toMs: now,
            status: 'validated',
          })
        ).length,
        totalAmount: monthTotal,
      },
      cashExpensesToday: todayExpenses,
      cashCollectedToday: 0,
      estimatedCashBalance: -todayExpenses,
    };
  }
}

@Injectable()
export class GetExpensesByCategoryUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  async execute(auth: AuthContext, query: { from?: number; to?: number }) {
    const now = Date.now();
    const fromMs = query.from ?? beninMonthStartMs(now);
    const toMs = query.to ?? now;
    return this.expenses.aggregateByCategory(auth.shopId, fromMs, toMs);
  }
}

@Injectable()
export class UpsertCategoryBudgetUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}

  execute(auth: AuthContext, categoryId: number, dto: UpsertCategoryBudgetDto) {
    return this.expenses.upsertBudget(auth.shopId, categoryId, dto.monthlyAmount);
  }
}

@Injectable()
export class GetExpenseProfitUseCase {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly reports: ReportReadRepository,
    private readonly aggregation: ReportAggregationService,
  ) {}

  async execute(auth: AuthContext, query: GetExpenseProfitQueryDto) {
    if (!auth.permissions.includes(Permission.REPORTS_FINANCIAL)) {
      throw new BadRequestException('Permission reports:financial requise.');
    }

    const preset = (query.period ?? 'month') as ReportPeriodPreset;
    let periodRange;
    try {
      periodRange = resolveReportPeriod(preset, Date.now(), query.from, query.to);
    } catch {
      throw new BadRequestException('Période invalide.');
    }

    const [raw, totalExpenses] = await Promise.all([
      this.reports.loadPeriodData({
        shopIds: [auth.shopId],
        fromMs: periodRange.fromMs,
        toMs: periodRange.toMs,
        includeSellerPerformance: false,
      }),
      this.expenses.sumValidatedExpenses(
        auth.shopId,
        periodRange.fromMs,
        periodRange.toMs,
      ),
    ]);

    const financial = this.aggregation.aggregateFinancial(raw.profitLines, raw.debtRecovery);
    const grossProfit = financial.estimatedProfit;
    const netProfit =
      grossProfit != null ? grossProfit - totalExpenses : null;

    return {
      period: periodRange,
      grossProfit,
      totalExpenses,
      netProfit,
      profitAvailable: financial.profitAvailable,
      profitWarning: financial.profitWarning,
    };
  }
}

type RepeatSchedule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

@Injectable()
export class GenerateRecurringExpensesUseCase {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly createExpense: CreateExpenseUseCase,
  ) {}

  async execute(auth: AuthContext) {
    const templates = (
      await this.expenses.listExpenses(auth.shopId, { status: 'validated' })
    ).filter((e) => e.repeatSchedule !== 'none' && e.deletedAt == null);

    let created = 0;
    const now = Date.now();

    for (const template of templates) {
      let cursor = template.expenseDate;
      while (true) {
        const next = this.nextOccurrence(template.repeatSchedule as RepeatSchedule, cursor);
        if (next > now) break;

        const [fromMs, toMs] = this.periodBounds(
          template.repeatSchedule as RepeatSchedule,
          next,
        );
        const exists = await this.hasOccurrence(
          auth.shopId,
          template,
          fromMs,
          toMs,
        );
        if (!exists) {
          await this.createExpense.execute(auth, {
            categoryId: template.categoryId ?? undefined,
            title: template.title,
            description: template.description ?? undefined,
            amount: template.amount,
            expenseDate: next,
            paymentMethod: template.paymentMethod,
            supplier: template.supplier ?? undefined,
            invoiceNumber: template.invoiceNumber ?? undefined,
            repeatSchedule: 'none',
            status: 'validated',
          });
          created++;
        }
        cursor = next;
      }
    }

    return { created };
  }

  private nextOccurrence(schedule: RepeatSchedule, fromMs: number): number {
    const date = new Date(fromMs);
    switch (schedule) {
      case 'daily':
        return date.getTime() + 86_400_000;
      case 'weekly':
        return date.getTime() + 7 * 86_400_000;
      case 'monthly':
        return new Date(date.getFullYear(), date.getMonth() + 1, date.getDate()).getTime();
      case 'yearly':
        return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate()).getTime();
      default:
        return fromMs;
    }
  }

  private periodBounds(schedule: RepeatSchedule, occurrenceMs: number): [number, number] {
    const date = new Date(occurrenceMs);
    switch (schedule) {
      case 'daily': {
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        return [start, start + 86_400_000 - 1];
      }
      case 'weekly': {
        const day = date.getDay() || 7;
        const monday = new Date(date);
        monday.setDate(date.getDate() - (day - 1));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return [monday.getTime(), sunday.getTime()];
      }
      case 'monthly': {
        const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        return [start, end];
      }
      case 'yearly': {
        const start = new Date(date.getFullYear(), 0, 1).getTime();
        const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
        return [start, end];
      }
      default:
        return [occurrenceMs, occurrenceMs];
    }
  }

  private async hasOccurrence(
    shopId: number,
    template: Expense,
    fromMs: number,
    toMs: number,
  ): Promise<boolean> {
    const rows = await this.expenses.listExpenses(shopId, {
      fromMs,
      toMs,
      status: 'validated',
    });
    return rows.some(
      (row) =>
        row.title === template.title &&
        row.amount === template.amount &&
        (template.categoryId == null || row.categoryId === template.categoryId),
    );
  }
}
