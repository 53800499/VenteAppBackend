import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import {
  beninDayStart,
  beninMonthStartMs,
} from '../../../../shared/utils/benin-period-range.util';
import {
  CategoryBudget,
  Expense,
  ExpenseByCategoryRow,
  ExpenseCategory,
  ExpenseHistoryEntry,
  ExpensePaymentMethod,
} from '../../domain/entities/expense.entity';
import {
  CreateExpenseCategoryData,
  CreateExpenseData,
  ExpenseRepository,
  ListExpensesFilters,
  UpdateExpenseCategoryData,
  UpdateExpenseData,
} from '../../domain/repositories/expense.repository';

const SYSTEM_CATEGORIES = [
  { name: 'Loyer', icon: 'home', color: '#6366F1' },
  { name: 'Salaire', icon: 'people', color: '#0EA5E9' },
  { name: 'Transport', icon: 'directions_car', color: '#F59E0B' },
  { name: 'Electricité', icon: 'bolt', color: '#EAB308' },
  { name: 'Eau', icon: 'water_drop', color: '#06B6D4' },
  { name: 'Internet', icon: 'wifi', color: '#8B5CF6' },
  { name: 'Fournitures', icon: 'inventory_2', color: '#64748B' },
  { name: 'Fiscalité', icon: 'receipt_long', color: '#EF4444' },
  { name: 'Retrait propriétaire', icon: 'account_balance_wallet', color: '#14B8A6' },
];

interface CategoryRow {
  id: number;
  shop_id: number;
  name: string;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  created_at: number;
  updated_at: number;
}

interface ExpenseRow {
  id: number;
  shop_id: number;
  category_id: number | null;
  title: string;
  description: string | null;
  amount: number;
  expense_date: number;
  payment_method: ExpensePaymentMethod;
  created_by: number;
  supplier: string | null;
  invoice_number: string | null;
  repeat_schedule: string;
  status: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  expense_categories?: { name: string } | { name: string }[] | null;
  users?: { name: string } | { name: string }[] | null;
}

@Injectable()
export class SupabaseExpenseRepository extends ExpenseRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async ensureSystemCategories(shopId: number): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('expense_categories')
      .select('id')
      .eq('shop_id', shopId)
      .limit(1);
    if (error) throw new BadRequestException(error.message);
    if ((data ?? []).length > 0) return;

    const timestamp = nowMs();
    const rows = SYSTEM_CATEGORIES.map((cat) => ({
      shop_id: shopId,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      is_system: true,
      created_at: timestamp,
      updated_at: timestamp,
    }));
    const insert = await this.supabase.db.from('expense_categories').insert(rows);
    if (insert.error) throw new BadRequestException(insert.error.message);
  }

  async listCategories(shopId: number): Promise<ExpenseCategory[]> {
    await this.ensureSystemCategories(shopId);
    const { data, error } = await this.supabase.db
      .from('expense_categories')
      .select('*')
      .eq('shop_id', shopId)
      .order('is_system', { ascending: false })
      .order('name');
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.mapCategory(row as CategoryRow));
  }

  async createCategory(shopId: number, data: CreateExpenseCategoryData): Promise<ExpenseCategory> {
    const timestamp = nowMs();
    const { data: row, error } = await this.supabase.db
      .from('expense_categories')
      .insert({
        shop_id: shopId,
        name: data.name,
        color: data.color ?? null,
        icon: data.icon ?? null,
        is_system: false,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.mapCategory(row as CategoryRow);
  }

  async updateCategory(
    shopId: number,
    categoryId: number,
    data: UpdateExpenseCategoryData,
  ): Promise<ExpenseCategory> {
    const existing = await this.fetchCategory(shopId, categoryId);
    if (!existing) throw new NotFoundException('Catégorie introuvable.');
    if (existing.isSystem && data.name && data.name !== existing.name) {
      throw new BadRequestException('Impossible de renommer une catégorie système.');
    }

    const { data: row, error } = await this.supabase.db
      .from('expense_categories')
      .update({
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        updated_at: nowMs(),
      })
      .eq('shop_id', shopId)
      .eq('id', categoryId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.mapCategory(row as CategoryRow);
  }

  async listExpenses(shopId: number, filters?: ListExpensesFilters): Promise<Expense[]> {
    let query = this.supabase.db
      .from('expenses')
      .select('*, expense_categories(name), users(name)')
      .eq('shop_id', shopId)
      .is('deleted_at', null);

    if (filters?.fromMs != null) query = query.gte('expense_date', filters.fromMs);
    if (filters?.toMs != null) query = query.lte('expense_date', filters.toMs);
    if (filters?.categoryId != null) query = query.eq('category_id', filters.categoryId);
    if (filters?.createdBy != null) query = query.eq('created_by', filters.createdBy);
    if (filters?.paymentMethod != null) query = query.eq('payment_method', filters.paymentMethod);
    if (filters?.status != null) query = query.eq('status', filters.status);
    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`title.ilike.${term},description.ilike.${term},supplier.ilike.${term}`);
    }

    const { data, error } = await query.order('expense_date', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.mapExpense(row as ExpenseRow));
  }

  async findExpense(shopId: number, expenseId: number): Promise<Expense | null> {
    const { data, error } = await this.supabase.db
      .from('expenses')
      .select('*, expense_categories(name), users(name)')
      .eq('shop_id', shopId)
      .eq('id', expenseId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? this.mapExpense(data as ExpenseRow) : null;
  }

  async createExpense(shopId: number, data: CreateExpenseData): Promise<Expense> {
    const timestamp = nowMs();
    const { data: row, error } = await this.supabase.db
      .from('expenses')
      .insert({
        shop_id: shopId,
        category_id: data.categoryId ?? null,
        title: data.title,
        description: data.description ?? null,
        amount: data.amount,
        expense_date: data.expenseDate,
        payment_method: data.paymentMethod,
        created_by: data.createdBy,
        supplier: data.supplier ?? null,
        invoice_number: data.invoiceNumber ?? null,
        repeat_schedule: data.repeatSchedule ?? 'none',
        status: data.status ?? 'validated',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('*, expense_categories(name), users(name)')
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.mapExpense(row as ExpenseRow);
  }

  async updateExpense(
    shopId: number,
    expenseId: number,
    data: UpdateExpenseData,
    userId: number,
  ): Promise<Expense> {
    const existing = await this.findExpense(shopId, expenseId);
    if (!existing) throw new NotFoundException('Dépense introuvable.');

    await this.recordChanges(shopId, expenseId, userId, existing, data);

    const { data: row, error } = await this.supabase.db
      .from('expenses')
      .update({
        ...(data.categoryId !== undefined ? { category_id: data.categoryId } : {}),
        ...(data.title != null ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.amount != null ? { amount: data.amount } : {}),
        ...(data.expenseDate != null ? { expense_date: data.expenseDate } : {}),
        ...(data.paymentMethod != null ? { payment_method: data.paymentMethod } : {}),
        ...(data.supplier !== undefined ? { supplier: data.supplier } : {}),
        ...(data.invoiceNumber !== undefined ? { invoice_number: data.invoiceNumber } : {}),
        ...(data.repeatSchedule != null ? { repeat_schedule: data.repeatSchedule } : {}),
        ...(data.status != null ? { status: data.status } : {}),
        updated_at: nowMs(),
      })
      .eq('shop_id', shopId)
      .eq('id', expenseId)
      .select('*, expense_categories(name), users(name)')
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.mapExpense(row as ExpenseRow);
  }

  async softDeleteExpense(shopId: number, expenseId: number, userId: number): Promise<void> {
    const existing = await this.findExpense(shopId, expenseId);
    if (!existing) throw new NotFoundException('Dépense introuvable.');

    await this.recordHistory(shopId, expenseId, userId, 'deleted_at', null, nowMs().toString());

    const { error } = await this.supabase.db
      .from('expenses')
      .update({ deleted_at: nowMs(), updated_at: nowMs() })
      .eq('shop_id', shopId)
      .eq('id', expenseId);
    if (error) throw new BadRequestException(error.message);
  }

  async listHistory(shopId: number, expenseId: number): Promise<ExpenseHistoryEntry[]> {
    const { data, error } = await this.supabase.db
      .from('expense_history')
      .select('*, users(name)')
      .eq('shop_id', shopId)
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => {
      const r = row as {
        id: number;
        expense_id: number;
        user_id: number;
        field_name: string;
        old_value: string | null;
        new_value: string | null;
        created_at: number;
        users?: { name: string } | { name: string }[] | null;
      };
      const users = r.users;
      const userName = Array.isArray(users) ? users[0]?.name ?? null : users?.name ?? null;
      return {
        id: r.id,
        expenseId: r.expense_id,
        userId: r.user_id,
        userName,
        fieldName: r.field_name,
        oldValue: r.old_value,
        newValue: r.new_value,
        createdAt: r.created_at,
      };
    });
  }

  async sumValidatedExpenses(shopId: number, fromMs: number, toMs: number): Promise<number> {
    const { data, error } = await this.supabase.db
      .from('expenses')
      .select('amount')
      .eq('shop_id', shopId)
      .eq('status', 'validated')
      .is('deleted_at', null)
      .gte('expense_date', fromMs)
      .lte('expense_date', toMs);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).reduce((sum, row) => sum + Number((row as { amount: number }).amount), 0);
  }

  async sumValidatedExpensesByMethod(
    shopId: number,
    fromMs: number,
    toMs: number,
    methods: ExpensePaymentMethod[],
  ): Promise<number> {
    const { data, error } = await this.supabase.db
      .from('expenses')
      .select('amount')
      .eq('shop_id', shopId)
      .eq('status', 'validated')
      .is('deleted_at', null)
      .in('payment_method', methods)
      .gte('expense_date', fromMs)
      .lte('expense_date', toMs);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).reduce((sum, row) => sum + Number((row as { amount: number }).amount), 0);
  }

  async aggregateByCategory(
    shopId: number,
    fromMs: number,
    toMs: number,
  ): Promise<ExpenseByCategoryRow[]> {
    const expenses = await this.listExpenses(shopId, { fromMs, toMs, status: 'validated' });
    const budgets = await this.listBudgets(shopId);
    const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));

    const byCategory = new Map<string, ExpenseByCategoryRow>();
    for (const expense of expenses) {
      const key = expense.categoryId?.toString() ?? 'none';
      const existing = byCategory.get(key);
      if (!existing) {
        byCategory.set(key, {
          categoryId: expense.categoryId,
          categoryName: expense.categoryName ?? 'Sans catégorie',
          expenseCount: 1,
          totalAmount: expense.amount,
          budgetAmount: expense.categoryId != null ? budgetByCategory.get(expense.categoryId) ?? null : null,
        });
      } else {
        existing.expenseCount += 1;
        existing.totalAmount += expense.amount;
      }
    }

    return [...byCategory.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async listBudgets(shopId: number): Promise<CategoryBudget[]> {
    const { data, error } = await this.supabase.db
      .from('category_budgets')
      .select('*, expense_categories(name)')
      .eq('shop_id', shopId);
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => {
      const r = row as {
        id: number;
        shop_id: number;
        category_id: number;
        monthly_amount: number;
        expense_categories?: { name: string } | { name: string }[] | null;
      };
      const categories = r.expense_categories;
      const categoryName = Array.isArray(categories)
        ? categories[0]?.name ?? 'Catégorie'
        : categories?.name ?? 'Catégorie';
      return {
        id: r.id,
        shopId: r.shop_id,
        categoryId: r.category_id,
        categoryName,
        monthlyAmount: Number(r.monthly_amount),
      };
    });
  }

  async upsertBudget(
    shopId: number,
    categoryId: number,
    monthlyAmount: number,
  ): Promise<CategoryBudget> {
    const timestamp = nowMs();
    const { data, error } = await this.supabase.db
      .from('category_budgets')
      .upsert(
        {
          shop_id: shopId,
          category_id: categoryId,
          monthly_amount: monthlyAmount,
          updated_at: timestamp,
          created_at: timestamp,
        },
        { onConflict: 'shop_id,category_id' },
      )
      .select('*, expense_categories(name)')
      .single();
    if (error) throw new BadRequestException(error.message);

    const r = data as {
      id: number;
      shop_id: number;
      category_id: number;
      monthly_amount: number;
      expense_categories?: { name: string } | { name: string }[] | null;
    };
    const categories = r.expense_categories;
    const categoryName = Array.isArray(categories)
      ? categories[0]?.name ?? 'Catégorie'
      : categories?.name ?? 'Catégorie';

    return {
      id: r.id,
      shopId: r.shop_id,
      categoryId: r.category_id,
      categoryName,
      monthlyAmount: Number(r.monthly_amount),
    };
  }

  private async fetchCategory(shopId: number, categoryId: number): Promise<ExpenseCategory | null> {
    const { data, error } = await this.supabase.db
      .from('expense_categories')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', categoryId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? this.mapCategory(data as CategoryRow) : null;
  }

  private mapCategory(row: CategoryRow): ExpenseCategory {
    return {
      id: row.id,
      shopId: row.shop_id,
      name: row.name,
      color: row.color,
      icon: row.icon,
      isSystem: row.is_system,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapExpense(row: ExpenseRow): Expense {
    const categories = row.expense_categories;
    const categoryName = Array.isArray(categories)
      ? categories[0]?.name ?? null
      : categories?.name ?? null;
    const users = row.users;
    const createdByName = Array.isArray(users) ? users[0]?.name ?? null : users?.name ?? null;

    return {
      id: row.id,
      shopId: row.shop_id,
      categoryId: row.category_id,
      categoryName,
      title: row.title,
      description: row.description,
      amount: Number(row.amount),
      expenseDate: row.expense_date,
      paymentMethod: row.payment_method,
      createdBy: row.created_by,
      createdByName,
      supplier: row.supplier,
      invoiceNumber: row.invoice_number,
      repeatSchedule: row.repeat_schedule as Expense['repeatSchedule'],
      status: row.status as Expense['status'],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  private async recordChanges(
    shopId: number,
    expenseId: number,
    userId: number,
    existing: Expense,
    data: UpdateExpenseData,
  ): Promise<void> {
    const pairs: Array<[string, string | null, string | null]> = [];
    if (data.title != null && data.title !== existing.title) {
      pairs.push(['title', existing.title, data.title]);
    }
    if (data.amount != null && data.amount !== existing.amount) {
      pairs.push(['amount', String(existing.amount), String(data.amount)]);
    }
    if (data.status != null && data.status !== existing.status) {
      pairs.push(['status', existing.status, data.status]);
    }
    for (const [field, oldValue, newValue] of pairs) {
      await this.recordHistory(shopId, expenseId, userId, field, oldValue, newValue);
    }
  }

  private async recordHistory(
    shopId: number,
    expenseId: number,
    userId: number,
    fieldName: string,
    oldValue: string | null,
    newValue: string | null,
  ): Promise<void> {
    const { error } = await this.supabase.db.from('expense_history').insert({
      shop_id: shopId,
      expense_id: expenseId,
      user_id: userId,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      created_at: nowMs(),
    });
    if (error) throw new BadRequestException(error.message);
  }
}

export { beninDayStart, beninMonthStartMs };