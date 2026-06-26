import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { SaleCustomerRepository } from '../../domain/repositories/sale.repository';

@Injectable()
export class SupabaseSaleCustomerRepository extends SaleCustomerRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findByIdAndShop(id: number, shopId: number) {
    const { data, error } = await this.supabase.db
      .from('customers')
      .select('id, name')
      .eq('id', id)
      .eq('shop_id', shopId)
      .eq('is_archived', false)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? { id: data.id as number, name: data.name as string } : null;
  }
}
