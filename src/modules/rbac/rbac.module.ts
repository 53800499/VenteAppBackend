import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import {
  CreateShopRoleUseCase,
  CreateUserOverrideUseCase,
  DeleteShopRoleUseCase,
  GetUserEffectivePermissionsUseCase,
  ListUserOverridesUseCase,
  RemoveUserOverrideUseCase,
  ReplaceUserOverridesUseCase,
  SetRolePermissionsUseCase,
  UpdateShopRoleUseCase,
} from './application/use-cases/rbac-management.use-cases';
import {
  CheckPermissionUseCase,
  GetMyPermissionsUseCase,
  GetPermissionsCatalogUseCase,
  GetRoleDetailUseCase,
  GetRolesCatalogUseCase,
} from './application/use-cases/rbac.use-cases';
import { RbacPermissionValidator } from './domain/services/rbac-permission.validator';
import { RbacController } from './presentation/controllers/rbac.controller';
import { RbacPersistenceModule } from './rbac-persistence.module';

@Module({
  imports: [
    CoreModule,
    RbacPersistenceModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    AuthorizationGuardsModule,
    AuditModule,
  ],
  controllers: [RbacController],
  providers: [
    RbacPermissionValidator,
    GetRolesCatalogUseCase,
    GetPermissionsCatalogUseCase,
    GetMyPermissionsUseCase,
    CheckPermissionUseCase,
    GetRoleDetailUseCase,
    CreateShopRoleUseCase,
    UpdateShopRoleUseCase,
    DeleteShopRoleUseCase,
    SetRolePermissionsUseCase,
    ListUserOverridesUseCase,
    CreateUserOverrideUseCase,
    RemoveUserOverrideUseCase,
    ReplaceUserOverridesUseCase,
    GetUserEffectivePermissionsUseCase,
  ],
  exports: [RbacPersistenceModule, GetMyPermissionsUseCase],
})
export class RbacModule {}
