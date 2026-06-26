import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RbacPersistenceModule } from '../rbac/rbac-persistence.module';
import { ShopsModule } from '../shops/shops.module';
import {
  AssignUserShopUseCase,
  GetUserAssignmentUseCase,
} from './application/use-cases/user-assignment.use-cases';
import {
  ChangeUserRoleUseCase,
  CreateShopUserUseCase,
  DeactivateShopUserUseCase,
  ListShopUsersUseCase,
} from './application/use-cases/user-management.use-cases';
import { UserAccessPolicy } from './domain/policies/user-access.policy';
import { UserRepository } from './domain/repositories/user.repository';
import { SupabaseUserRepository } from './infrastructure/repositories/user.repository';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [
    CoreModule,
    RbacPersistenceModule,
    forwardRef(() => AuthModule),
    forwardRef(() => ShopsModule),
    AuditModule,
    AuthorizationGuardsModule,
  ],
  controllers: [UsersController],
  providers: [
    { provide: UserRepository, useClass: SupabaseUserRepository },
    UserAccessPolicy,
    ListShopUsersUseCase,
    CreateShopUserUseCase,
    ChangeUserRoleUseCase,
    DeactivateShopUserUseCase,
    GetUserAssignmentUseCase,
    AssignUserShopUseCase,
  ],
  exports: [UserRepository, UserAccessPolicy],
})
export class UsersModule {}
