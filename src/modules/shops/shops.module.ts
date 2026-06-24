import { Module } from '@nestjs/common';
import { SettingsRepository } from './domain/repositories/settings.repository';
import { ShopRepository } from './domain/repositories/shop.repository';
import { SupabaseSettingsRepository } from './infrastructure/repositories/settings.repository';
import { SupabaseShopRepository } from './infrastructure/repositories/shop.repository';

@Module({
  providers: [
    { provide: ShopRepository, useClass: SupabaseShopRepository },
    { provide: SettingsRepository, useClass: SupabaseSettingsRepository },
  ],
  exports: [ShopRepository, SettingsRepository],
})
export class ShopsModule {}
