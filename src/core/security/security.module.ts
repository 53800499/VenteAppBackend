import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { RbacPersistenceModule } from '../../modules/rbac/rbac-persistence.module';
import { LockoutPolicyService } from './lockout-policy.service';
import { PermissionService } from './permission.service';
import { PinHasherService } from './pin-hasher.service';
import { RecoveryTokenService } from './recovery-token.service';

@Module({
  imports: [RbacPersistenceModule, CacheModule],
  providers: [PinHasherService, RecoveryTokenService, LockoutPolicyService, PermissionService],
  exports: [PinHasherService, RecoveryTokenService, LockoutPolicyService, PermissionService],
})
export class SecurityModule {}
