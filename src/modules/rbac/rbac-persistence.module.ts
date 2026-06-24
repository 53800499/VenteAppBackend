import { Module } from '@nestjs/common';
import { CacheModule } from '../../core/cache/cache.module';
import { RbacRepository } from './domain/repositories/rbac.repository';
import { EffectivePermissionResolver } from './domain/services/effective-permission.resolver';
import { SupabaseRbacRepository } from './infrastructure/repositories/rbac.repository';

@Module({
  imports: [CacheModule],
  providers: [
    { provide: RbacRepository, useClass: SupabaseRbacRepository },
    EffectivePermissionResolver,
  ],
  exports: [RbacRepository, EffectivePermissionResolver],
})
export class RbacPersistenceModule {}
