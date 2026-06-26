import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { Payment } from '../../domain/entities/payment.entity';
import {
  CreatePaymentData,
  PaymentListFilters,
  PaymentRepository,
} from '../../domain/repositories/payment.repository';
import { PaymentMapper } from '../mappers/payment.mapper';
import { PaymentRow } from '../persistence/payment.row';

@Injectable()
export class SupabasePaymentRepository extends PaymentRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findByIdAndShop(id: number, shopId: number): Promise<Payment | null> {
    const { data, error } = await this.supabase.db
      .from('payments')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? PaymentMapper.toDomain(data as PaymentRow) : null;
  }

  async listByShop(shopId: number, filters?: PaymentListFilters): Promise<Payment[]> {
    let query = this.supabase.db.from('payments').select('*').eq('shop_id', shopId);

    if (filters?.saleId) query = query.eq('sale_id', filters.saleId);
    if (filters?.debtId) query = query.eq('debt_id', filters.debtId);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
    if (filters?.method) query = query.eq('method', filters.method);
    if (filters?.from) query = query.gte('created_at', filters.from);
    if (filters?.to) query = query.lte('created_at', filters.to);

    query = query.order('created_at', { ascending: false });
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => PaymentMapper.toDomain(row as PaymentRow));
  }

  async countByShopOnDay(shopId: number, dayStartMs: number, dayEndMs: number): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .gte('created_at', dayStartMs)
      .lte('created_at', dayEndMs);
    if (error) throw new BadRequestException(error.message);
    return count ?? 0;
  }

  async create(data: CreatePaymentData): Promise<Payment> {
    const { data: row, error } = await this.supabase.db
      .from('payments')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Création paiement impossible.');
    }
    return PaymentMapper.toDomain(row as PaymentRow);
  }
}
