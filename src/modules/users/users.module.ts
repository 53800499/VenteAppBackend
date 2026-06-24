import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import {
  ChangeUserRoleUseCase,
  CreateShopUserUseCase,
  DeactivateShopUserUseCase,
  ListShopUsersUseCase,
} from './application/use-cases/user-management.use-cases';
import { UserRepository } from './domain/repositories/user.repository';
import { SupabaseUserRepository } from './infrastructure/repositories/user.repository';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [CoreModule, forwardRef(() => AuthModule), AuditModule, AuthorizationGuardsModule],
  controllers: [UsersController],
  providers: [
    { provide: UserRepository, useClass: SupabaseUserRepository },
    ListShopUsersUseCase,
    CreateShopUserUseCase,
    ChangeUserRoleUseCase,
    DeactivateShopUserUseCase,
  ],
  exports: [UserRepository],
})
export class UsersModule {}
