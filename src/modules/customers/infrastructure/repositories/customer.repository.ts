import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { Customer, CustomerSaleSummary } from '../../domain/entities/customer.entity';
import {
  CreateCustomerData,
  CustomerListFilters,
  CustomerRepository,
  DebtorSummaryRow,
} from '../../domain/repositories/customer.repository';
import { CustomerMapper } from '../mappers/customer.mapper';
import { CustomerRow, CustomerSaleRow, CustomerStatsRow } from '../persistence/customer.row';

@Injectable()
export class SupabaseCustomerRepository extends CustomerRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findByIdAndShop(id: number, shopId: number, includeArchived = true): Promise<Customer | null> {
    let query = this.supabase.db.from('customers').select('*').eq('id', id).eq('shop_id', shopId);
    if (!includeArchived) query = query.eq('is_archived', false);

    const { data, error } = await query.maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;

    const stats = await this.fetchStatsForCustomers(shopId, [id]);
    return CustomerMapper.toDomain(data as CustomerRow, stats.get(id));
  }

  async listByShop(shopId: number, filters?: CustomerListFilters): Promise<Customer[]> {
    let query = this.supabase.db.from('customers').select('*').eq('shop_id', shopId);

    if (!filters?.includeArchived) query = query.eq('is_archived', false);
    if (filters?.search) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as CustomerRow[];
    const ids = rows.map((r) => r.id);
    const statsMap = await this.fetchStatsForCustomers(shopId, ids);

    let customers = rows.map((row) => CustomerMapper.toDomain(row, statsMap.get(row.id)));

    if (filters?.hasDebt) {
      customers = customers.filter((c) => c.balanceDue > 0);
    }

    const sort = filters?.sort ?? 'name';
    customers.sort((a, b) => {
      if (sort === 'debt') return b.balanceDue - a.balanceDue || a.name.localeCompare(b.name);
      if (sort === 'lastActivity') {
        const aTime = a.lastActivityAt ?? 0;
        const bTime = b.lastActivityAt ?? 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name, 'fr');
    });

    if (filters?.limit) customers = customers.slice(0, filters.limit);
    return customers;
  }

  async listDebtors(shopId: number): Promise<DebtorSummaryRow[]> {
    const { data, error } = await this.supabase.db
      .from('debts')
      .select('customer_id, amount_remaining, created_at, customers(name, phone)')
      .eq('shop_id', shopId)
      .in('status', ['open', 'partial'])
      .gt('amount_remaining', 0);
    if (error) throw new BadRequestException(error.message);

    const byCustomer = new Map<number, DebtorSummaryRow>();
    for (const row of data ?? []) {
      const customerId = row.customer_id as number;
      const amount = Number(row.amount_remaining);
      const createdAt = row.created_at as number;
      const customerRel = row.customers as { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
      const customer = Array.isArray(customerRel) ? customerRel[0] : customerRel;

      const existing = byCustomer.get(customerId);
      if (!existing) {
        byCustomer.set(customerId, {
          customerId,
          customerName: customer?.name ?? 'Client',
          phone: customer?.phone ?? null,
          balanceDue: amount,
          openDebtsCount: 1,
          oldestDebtAt: createdAt,
        });
      } else {
        existing.balanceDue += amount;
        existing.openDebtsCount += 1;
        existing.oldestDebtAt = Math.min(existing.oldestDebtAt, createdAt);
      }
    }

    return [...byCustomer.values()].sort((a, b) => b.balanceDue - a.balanceDue);
  }

  async create(data: CreateCustomerData): Promise<Customer> {
    const { data: row, error } = await this.supabase.db
      .from('customers')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) throw new BadRequestException(error?.message ?? 'Création client impossible.');
    return CustomerMapper.toDomain(row as CustomerRow);
  }

  async updateInShop(id: number, shopId: number, patch: Record<string, unknown>): Promise<Customer> {
    const { data, error } = await this.supabase.db
      .from('customers')
      .update(patch)
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException(error?.message ?? 'Mise à jour client impossible.');
    const stats = await this.fetchStatsForCustomers(shopId, [id]);
    return CustomerMapper.toDomain(data as CustomerRow, stats.get(id));
  }

  async archive(id: number, shopId: number, updatedAt: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('customers')
      .update({ is_archived: true, updated_at: updatedAt })
      .eq('id', id)
      .eq('shop_id', shopId)
      .eq('is_archived', false);
    if (error) throw new BadRequestException(error.message);
  }

  async countOpenDebts(id: number, shopId: number): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id)
      .eq('shop_id', shopId)
      .in('status', ['open', 'partial'])
      .gt('amount_remaining', 0);
    if (error) throw new BadRequestException(error.message);
    return count ?? 0;
  }

  async listSales(id: number, shopId: number, limit = 20): Promise<CustomerSaleSummary[]> {
    const { data, error } = await this.supabase.db
      .from('sales')
      .select('id, receipt_number, total_amount, status, created_at')
      .eq('customer_id', id)
      .eq('shop_id', shopId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map(
      (row) =>
        new CustomerSaleSummary(
          (row as CustomerSaleRow).id,
          (row as CustomerSaleRow).receipt_number,
          Number((row as CustomerSaleRow).total_amount),
          (row as CustomerSaleRow).status,
          (row as CustomerSaleRow).created_at,
        ),
    );
  }

  private async fetchStatsForCustomers(
    shopId: number,
    customerIds: number[],
  ): Promise<Map<number, CustomerStatsRow>> {
    const result = new Map<number, CustomerStatsRow>();
    if (customerIds.length === 0) return result;

    const [debtsRes, salesRes] = await Promise.all([
      this.supabase.db
        .from('debts')
        .select('customer_id, amount_remaining, created_at')
        .eq('shop_id', shopId)
        .in('customer_id', customerIds)
        .in('status', ['open', 'partial'])
        .gt('amount_remaining', 0),
      this.supabase.db
        .from('sales')
        .select('customer_id, total_amount, created_at')
        .eq('shop_id', shopId)
        .in('customer_id', customerIds)
        .neq('status', 'cancelled'),
    ]);

    if (debtsRes.error) throw new BadRequestException(debtsRes.error.message);
    if (salesRes.error) throw new BadRequestException(salesRes.error.message);

    for (const id of customerIds) {
      result.set(id, {
        balance_due: 0,
        open_debts_count: 0,
        purchase_count: 0,
        total_purchases: 0,
        last_activity_at: null,
      });
    }

    for (const row of debtsRes.data ?? []) {
      const customerId = row.customer_id as number;
      const stats = result.get(customerId);
      if (!stats) continue;
      stats.balance_due += Number(row.amount_remaining);
      stats.open_debts_count += 1;
    }

    for (const row of salesRes.data ?? []) {
      const customerId = row.customer_id as number;
      const stats = result.get(customerId);
      if (!stats) continue;
      stats.purchase_count += 1;
      stats.total_purchases += Number(row.total_amount);
      const createdAt = row.created_at as number;
      stats.last_activity_at =
        stats.last_activity_at == null ? createdAt : Math.max(stats.last_activity_at, createdAt);
    }

    return result;
  }
}
