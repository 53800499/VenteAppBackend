import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { IdentityRepository } from './domain/repositories/identity.repository';
import { IdentityProvisioningService } from './domain/services/identity-provisioning.service';
import { SupabaseIdentityRepository } from './infrastructure/repositories/identity.repository';
import { GetIdentityContextUseCase } from './application/use-cases/get-identity-context.use-case';
import { GetUserShopAccessUseCase } from './application/use-cases/get-user-shop-access.use-case';
import { SyncUserShopAccessUseCase } from './application/use-cases/sync-user-shop-access.use-case';
import { IdentityController } from './presentation/controllers/identity.controller';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import { AuditPersistenceModule } from '../audit/audit-persistence.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';

@Module({
  imports: [
    CoreModule,
    forwardRef(() => ShopsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    AuditPersistenceModule,
    AuthorizationGuardsModule,
  ],
  controllers: [IdentityController],
  providers: [
    { provide: IdentityRepository, useClass: SupabaseIdentityRepository },
    IdentityProvisioningService,
    GetIdentityContextUseCase,
    GetUserShopAccessUseCase,
    SyncUserShopAccessUseCase,
  ],
  exports: [IdentityRepository, IdentityProvisioningService, GetIdentityContextUseCase],
})
export class IdentityModule {}
