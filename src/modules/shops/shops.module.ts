import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import {
  CreateShopUseCase,
  DeactivateShopUseCase,
  GetOwnedShopUseCase,
  ListOwnedShopsUseCase,
  SetDefaultShopUseCase,
  UpdateShopUseCase,
} from './application/use-cases/shop-management.use-cases';
import { SettingsRepository } from './domain/repositories/settings.repository';
import { ShopRepository } from './domain/repositories/shop.repository';
import { ShopOwnershipService } from './domain/services/shop-ownership.service';
import { SupabaseSettingsRepository } from './infrastructure/repositories/settings.repository';
import { SupabaseShopRepository } from './infrastructure/repositories/shop.repository';
import { ShopsController } from './presentation/controllers/shops.controller';

@Module({
  imports: [
    CoreModule,
    ConfigModule,
    AuthorizationGuardsModule,
    AuditModule,
    TenantsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [ShopsController],
  providers: [
    { provide: ShopRepository, useClass: SupabaseShopRepository },
    { provide: SettingsRepository, useClass: SupabaseSettingsRepository },
    ShopOwnershipService,
    ListOwnedShopsUseCase,
    GetOwnedShopUseCase,
    CreateShopUseCase,
    UpdateShopUseCase,
    DeactivateShopUseCase,
    SetDefaultShopUseCase,
  ],
  exports: [ShopRepository, SettingsRepository, ShopOwnershipService],
})
export class ShopsModule {}
