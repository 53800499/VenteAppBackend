import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { SaleDebtRepository } from '../../domain/repositories/sale.repository';

@Injectable()
export class SupabaseSaleDebtRepository extends SaleDebtRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findBySaleId(saleId: number, shopId: number) {
    const { data, error } = await this.supabase.db
      .from('debts')
      .select('id, amount_paid, amount_remaining, status')
      .eq('sale_id', saleId)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return {
      id: data.id as number,
      amountPaid: data.amount_paid as number,
      amountRemaining: data.amount_remaining as number,
      status: data.status as string,
    };
  }

  async create(data: Record<string, unknown>) {
    const { data: row, error } = await this.supabase.db
      .from('debts')
      .insert(data)
      .select('id')
      .single();
    if (error || !row) throw new BadRequestException(error?.message ?? 'Création dette impossible.');
    return { id: row.id as number };
  }

  async closeBySaleId(saleId: number, shopId: number, updatedAt: number) {
    const { error } = await this.supabase.db
      .from('debts')
      .update({
        status: 'closed',
        amount_remaining: 0,
        version: 1,
      })
      .eq('sale_id', saleId)
      .eq('shop_id', shopId)
      .eq('status', 'open');
    if (error) throw new BadRequestException(error.message);
    void updatedAt;
  }
}
