import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import { TenantModule, CalculatorProductData, CalculatorHistory } from '../../domain/entities/calculators.entity';
import { CalculatorsRepository } from '../../domain/repositories/calculators.repository';

@Injectable()
export class SupabaseCalculatorsRepository implements CalculatorsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findModuleStatus(shopId: number, moduleCode: string): Promise<TenantModule | null> {
    const { data, error } = await this.supabase.db
      .from('tenant_modules')
      .select('*')
      .eq('shop_id', shopId)
      .eq('module_code', moduleCode)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) return null;

    return new TenantModule(
      data.id,
      data.shop_id,
      data.module_code,
      data.enabled,
      data.created_at,
    );
  }

  async toggleModule(shopId: number, moduleCode: string, enabled: boolean): Promise<TenantModule> {
    const timestamp = nowMs();
    const { data, error } = await this.supabase.db
      .from('tenant_modules')
      .upsert(
        {
          shop_id: shopId,
          module_code: moduleCode,
          enabled: enabled,
          created_at: timestamp,
        },
        { onConflict: 'shop_id,module_code' },
      )
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return new TenantModule(
      data.id,
      data.shop_id,
      data.module_code,
      data.enabled,
      data.created_at,
    );
  }

  async listProductData(shopId: number): Promise<CalculatorProductData[]> {
    const { data, error } = await this.supabase.db
      .from('calculator_product_data')
      .select('*')
      .eq('shop_id', shopId);

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map(
      (row) =>
        new CalculatorProductData(
          row.id,
          row.shop_id,
          row.product_id,
          row.calculator_type,
          row.metadata,
          row.version,
          row.server_id,
          row.sync_status,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async upsertProductData(
    shopId: number,
    productId: number,
    type: string,
    metadata: Record<string, any>,
  ): Promise<CalculatorProductData> {
    const timestamp = nowMs();
    const { data, error } = await this.supabase.db
      .from('calculator_product_data')
      .upsert(
        {
          shop_id: shopId,
          product_id: productId,
          calculator_type: type,
          metadata: metadata,
          updated_at: timestamp,
          version: 1,
        },
        { onConflict: 'shop_id,product_id' },
      )
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return new CalculatorProductData(
      data.id,
      data.shop_id,
      data.product_id,
      data.calculator_type,
      data.metadata,
      data.version,
      data.server_id,
      data.sync_status,
      data.created_at,
      data.updated_at,
    );
  }

  async listHistory(shopId: number): Promise<CalculatorHistory[]> {
    const { data, error } = await this.supabase.db
      .from('calculator_history')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map(
      (row) =>
        new CalculatorHistory(
          row.id,
          row.shop_id,
          row.calculator_type,
          row.input,
          row.result,
          row.is_favorite,
          row.label,
          row.created_at,
          row.created_by,
          row.version,
          row.server_id,
          row.sync_status,
        ),
    );
  }

  async createHistory(
    shopId: number,
    payload: {
      calculatorType: string;
      input: Record<string, any>;
      result: Record<string, any>;
      isFavorite?: boolean;
      label?: string | null;
      createdBy: number;
    },
  ): Promise<CalculatorHistory> {
    const timestamp = nowMs();
    const { data, error } = await this.supabase.db
      .from('calculator_history')
      .insert({
        shop_id: shopId,
        calculator_type: payload.calculatorType,
        input: payload.input,
        result: payload.result,
        is_favorite: payload.isFavorite ?? false,
        label: payload.label ?? null,
        created_at: timestamp,
        created_by: payload.createdBy,
        version: 1,
        sync_status: 'synced',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return new CalculatorHistory(
      data.id,
      data.shop_id,
      data.calculator_type,
      data.input,
      data.result,
      data.is_favorite,
      data.label,
      data.created_at,
      data.created_by,
      data.version,
      data.server_id,
      data.sync_status,
    );
  }
}
