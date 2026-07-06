export type ExpensePaymentMethod =
  | 'cash'
  | 'mtn_momo'
  | 'moov_money'
  | 'card'
  | 'transfer'
  | 'check';

export type ExpenseRepeatSchedule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ExpenseStatus = 'draft' | 'pending' | 'validated' | 'refused';

export interface ExpenseCategory {
  id: number;
  shopId: number;
  name: string;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Expense {
  id: number;
  shopId: number;
  categoryId: number | null;
  categoryName: string | null;
  title: string;
  description: string | null;
  amount: number;
  expenseDate: number;
  paymentMethod: ExpensePaymentMethod;
  createdBy: number;
  createdByName: string | null;
  supplier: string | null;
  invoiceNumber: string | null;
  repeatSchedule: ExpenseRepeatSchedule;
  status: ExpenseStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface ExpenseHistoryEntry {
  id: number;
  expenseId: number;
  userId: number;
  userName: string | null;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: number;
}

export interface CategoryBudget {
  id: number;
  shopId: number;
  categoryId: number;
  categoryName: string;
  monthlyAmount: number;
}

export interface ExpenseSummaryPeriod {
  expenseCount: number;
  totalAmount: number;
}

export interface ExpenseSummary {
  today: ExpenseSummaryPeriod;
  week: ExpenseSummaryPeriod;
  month: ExpenseSummaryPeriod;
  estimatedCashBalance: number;
  cashCollectedToday: number;
  cashExpensesToday: number;
}

export interface ExpenseProfitSnapshot {
  grossProfit: number | null;
  totalExpenses: number;
  netProfit: number | null;
  profitAvailable: boolean;
  profitWarning: string | null;
}

export interface ExpenseByCategoryRow {
  categoryId: number | null;
  categoryName: string;
  expenseCount: number;
  totalAmount: number;
  budgetAmount: number | null;
}
