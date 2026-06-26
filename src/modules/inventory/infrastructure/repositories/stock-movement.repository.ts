import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { StockMovement } from '../../domain/entities/stock-movement.entity';
import {
  CreateStockMovementData,
  StockMovementRepository,
} from '../../domain/repositories/stock-movement.repository';
import { StockMovementMapper } from '../mappers/stock-movement.mapper';
import { StockMovementRow } from '../persistence/stock-movement.row';

@Injectable()
export class SupabaseStockMovementRepository extends StockMovementRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(data: CreateStockMovementData): Promise<StockMovement> {
    const { data: row, error } = await this.supabase.db
      .from('stock_movements')
      .insert(data)
      .select('*')
      .single();
    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Enregistrement mouvement impossible.');
    }
    return StockMovementMapper.toDomain(row as StockMovementRow);
  }

  async findRecentByProduct(productId: number, shopId: number, limit: number): Promise<StockMovement[]> {
    const { data, error } = await this.supabase.db
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => StockMovementMapper.toDomain(row as StockMovementRow));
  }
}
