import {
  CategoryBudget,
  Expense,
  ExpenseByCategoryRow,
  ExpenseCategory,
  ExpenseHistoryEntry,
  ExpensePaymentMethod,
  ExpenseRepeatSchedule,
  ExpenseStatus,
} from '../entities/expense.entity';

export interface CreateExpenseCategoryData {
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateExpenseCategoryData {
  name?: string;
  color?: string | null;
  icon?: string | null;
}

export interface CreateExpenseData {
  categoryId?: number | null;
  title: string;
  description?: string | null;
  amount: number;
  expenseDate: number;
  paymentMethod: ExpensePaymentMethod;
  createdBy: number;
  supplier?: string | null;
  invoiceNumber?: string | null;
  repeatSchedule?: ExpenseRepeatSchedule;
  status?: ExpenseStatus;
}

export interface UpdateExpenseData {
  categoryId?: number | null;
  title?: string;
  description?: string | null;
  amount?: number;
  expenseDate?: number;
  paymentMethod?: ExpensePaymentMethod;
  supplier?: string | null;
  invoiceNumber?: string | null;
  repeatSchedule?: ExpenseRepeatSchedule;
  status?: ExpenseStatus;
}

export interface ListExpensesFilters {
  fromMs?: number;
  toMs?: number;
  categoryId?: number;
  createdBy?: number;
  paymentMethod?: ExpensePaymentMethod;
  status?: ExpenseStatus;
  search?: string;
}

export abstract class ExpenseRepository {
  abstract ensureSystemCategories(shopId: number): Promise<void>;
  abstract listCategories(shopId: number): Promise<ExpenseCategory[]>;
  abstract createCategory(shopId: number, data: CreateExpenseCategoryData): Promise<ExpenseCategory>;
  abstract updateCategory(
    shopId: number,
    categoryId: number,
    data: UpdateExpenseCategoryData,
  ): Promise<ExpenseCategory>;
  abstract listExpenses(shopId: number, filters?: ListExpensesFilters): Promise<Expense[]>;
  abstract findExpense(shopId: number, expenseId: number): Promise<Expense | null>;
  abstract createExpense(shopId: number, data: CreateExpenseData): Promise<Expense>;
  abstract updateExpense(
    shopId: number,
    expenseId: number,
    data: UpdateExpenseData,
    userId: number,
  ): Promise<Expense>;
  abstract softDeleteExpense(shopId: number, expenseId: number, userId: number): Promise<void>;
  abstract listHistory(shopId: number, expenseId: number): Promise<ExpenseHistoryEntry[]>;
  abstract sumValidatedExpenses(shopId: number, fromMs: number, toMs: number): Promise<number>;
  abstract sumValidatedExpensesByMethod(
    shopId: number,
    fromMs: number,
    toMs: number,
    methods: ExpensePaymentMethod[],
  ): Promise<number>;
  abstract aggregateByCategory(
    shopId: number,
    fromMs: number,
    toMs: number,
  ): Promise<ExpenseByCategoryRow[]>;
  abstract listBudgets(shopId: number): Promise<CategoryBudget[]>;
  abstract upsertBudget(shopId: number, categoryId: number, monthlyAmount: number): Promise<CategoryBudget>;
}
