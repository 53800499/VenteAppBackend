import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { Debt } from '../../domain/entities/debt.entity';
import {
  DebtListFilters,
  DebtRepository,
  DebtShopSummary,
  ForgiveDebtData,
  RecordDebtPaymentData,
} from '../../domain/repositories/debt.repository';
import { DebtMapper } from '../mappers/debt.mapper';
import { DebtPaymentRow, DebtRow } from '../persistence/debt.row';

const CRITICAL_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SupabaseDebtRepository extends DebtRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findByIdAndShop(id: number, shopId: number, withPayments = false): Promise<Debt | null> {
    const { data, error } = await this.supabase.db
      .from('debts')
      .select('*, customers(name)')
      .eq('id', id)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;

    let payments: DebtPaymentRow[] = [];
    if (withPayments) {
      const { data: paymentRows, error: payError } = await this.supabase.db
        .from('debt_payments')
        .select('*')
        .eq('debt_id', id)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: true });
      if (payError) throw new BadRequestException(payError.message);
      payments = (paymentRows ?? []) as DebtPaymentRow[];
    }

    return DebtMapper.toDomain(data as DebtRow, payments);
  }

  async listByShop(shopId: number, filters?: DebtListFilters): Promise<Debt[]> {
    let query = this.supabase.db
      .from('debts')
      .select('*, customers(name)')
      .eq('shop_id', shopId);

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);

    if (filters?.criticalOnly) {
      const cutoff = Date.now() - CRITICAL_CUTOFF_MS;
      query = query
        .in('status', ['open', 'partial'])
        .eq('amount_paid', 0)
        .lte('created_at', cutoff);
    } else if (!filters?.status) {
      query = query.in('status', ['open', 'partial']);
    }

    query = query.order('created_at', { ascending: true });
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => DebtMapper.toDomain(row as DebtRow));
  }

  async getShopSummary(shopId: number): Promise<DebtShopSummary> {
    const cutoff = Date.now() - CRITICAL_CUTOFF_MS;
    const { data, error } = await this.supabase.db
      .from('debts')
      .select('customer_id, amount_remaining, amount_paid, created_at')
      .eq('shop_id', shopId)
      .in('status', ['open', 'partial'])
      .gt('amount_remaining', 0);
    if (error) throw new BadRequestException(error.message);

    const rows = data ?? [];
    const debtors = new Set<number>();
    let criticalDebtsCount = 0;

    for (const row of rows) {
      debtors.add(row.customer_id as number);
      if (Number(row.amount_paid) === 0 && (row.created_at as number) <= cutoff) {
        criticalDebtsCount += 1;
      }
    }

    return {
      totalDebt: rows.reduce((sum, r) => sum + Number(r.amount_remaining), 0),
      openDebtsCount: rows.length,
      criticalDebtsCount,
      debtorCount: debtors.size,
    };
  }

  async recordPayment(data: RecordDebtPaymentData): Promise<{ paymentId: number; debtPaymentId: number }> {
    const { data: paymentRow, error: paymentError } = await this.supabase.db
      .from('payments')
      .insert({
        shop_id: data.shop_id,
        debt_id: data.debt_id,
        customer_id: data.customer_id,
        user_id: data.user_id,
        receipt_number: data.receipt_number,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        change_given: data.change_given,
        status: 'confirmed',
        note: data.note,
        created_at: data.created_at,
      })
      .select('id')
      .single();
    if (paymentError || !paymentRow) {
      throw new BadRequestException(paymentError?.message ?? 'Création paiement impossible.');
    }

    const paymentId = paymentRow.id as number;

    const { data: debtPaymentRow, error: debtPaymentError } = await this.supabase.db
      .from('debt_payments')
      .insert({
        shop_id: data.shop_id,
        debt_id: data.debt_id,
        payment_id: paymentId,
        user_id: data.user_id,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        created_at: data.created_at,
      })
      .select('id')
      .single();
    if (debtPaymentError || !debtPaymentRow) {
      throw new BadRequestException(debtPaymentError?.message ?? 'Création remboursement impossible.');
    }

    const { error: debtError } = await this.supabase.db
      .from('debts')
      .update({
        amount_paid: data.new_amount_paid,
        amount_remaining: data.new_amount_remaining,
        status: data.new_status,
        updated_at: data.updated_at,
      })
      .eq('id', data.debt_id)
      .eq('shop_id', data.shop_id);
    if (debtError) throw new BadRequestException(debtError.message);

    return { paymentId, debtPaymentId: debtPaymentRow.id as number };
  }

  async forgive(id: number, shopId: number, data: ForgiveDebtData): Promise<void> {
    const { error } = await this.supabase.db
      .from('debts')
      .update({
        status: 'forgiven',
        amount_remaining: 0,
        forgiven_by_user_id: data.forgiven_by_user_id,
        forgiven_at: data.forgiven_at,
        forgiven_reason: data.forgiven_reason,
        updated_at: data.updated_at,
      })
      .eq('id', id)
      .eq('shop_id', shopId)
      .in('status', ['open', 'partial']);
    if (error) throw new BadRequestException(error.message);
  }
}
