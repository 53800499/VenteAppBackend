import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { SessionGuard } from '../../shared/guards/session.guard';
import { AuditModule } from '../audit/audit.module';
import { ShopsModule } from '../shops/shops.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { EmergencyUnlockUseCase } from './application/use-cases/emergency-unlock.use-case';
import { EnableBiometricUseCase } from './application/use-cases/enable-biometric.use-case';
import { GetLockScreenUseCase } from './application/use-cases/get-lock-screen.use-case';
import { LoginWithPinUseCase } from './application/use-cases/login-with-pin.use-case';
import { SetupOwnerUseCase } from './application/use-cases/setup-owner.use-case';
import { TouchSessionUseCase } from './application/use-cases/touch-session.use-case';
import { AuthSessionRepository } from './domain/repositories/auth-session.repository';
import { SessionFactoryService } from './domain/services/session-factory.service';
import { UserResolverService } from './domain/services/user-resolver.service';
import { SupabaseAuthSessionRepository } from './infrastructure/repositories/auth-session.repository';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthPresenter } from './presentation/presenters/auth.presenter';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    forwardRef(() => UsersModule),
    ShopsModule,
    AuditModule,
    TenantsModule,
  ],
  controllers: [AuthController],
  providers: [
    { provide: AuthSessionRepository, useClass: SupabaseAuthSessionRepository },
    SessionFactoryService,
    UserResolverService,
    AuthPresenter,
    GetLockScreenUseCase,
    SetupOwnerUseCase,
    LoginWithPinUseCase,
    EmergencyUnlockUseCase,
    EnableBiometricUseCase,
    TouchSessionUseCase,
    SessionGuard,
  ],
  exports: [AuthSessionRepository, SessionGuard],
})
export class AuthModule {}
