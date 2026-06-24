import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

@Injectable()
export class TenantDatabaseService {
  private readonly logger = new Logger(TenantDatabaseService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async setShopId(shopId: number): Promise<void> {
    const { error } = await this.supabase.db.rpc('app_set_shop_id', { p_shop_id: shopId });
    if (error) {
      this.logger.warn(`app_set_shop_id indisponible (migration 003 ?): ${error.message}`);
    }
  }

  async clearShopId(): Promise<void> {
    const { error } = await this.supabase.db.rpc('app_clear_shop_id');
    if (error) {
      this.logger.warn(`app_clear_shop_id indisponible: ${error.message}`);
    }
  }

  async runWithTenant<T>(shopId: number, fn: () => Promise<T>): Promise<T> {
    await this.setShopId(shopId);
    try {
      return await fn();
    } finally {
      await this.clearShopId();
    }
  }

  async runWithoutTenant<T>(fn: () => Promise<T>): Promise<T> {
    await this.clearShopId();
    return fn();
  }
}
