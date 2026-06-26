import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { SessionGuard } from '../../shared/guards/session.guard';
import { AuditModule } from '../audit/audit.module';
import { ShopsModule } from '../shops/shops.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import {
  ListDeviceSessionsUseCase,
  LogoutUseCase,
  RefreshTokensUseCase,
  RevokeDeviceSessionUseCase,
} from './application/use-cases/jwt-auth.use-cases';
import { EmergencyUnlockUseCase } from './application/use-cases/emergency-unlock.use-case';
import { EnableBiometricUseCase } from './application/use-cases/enable-biometric.use-case';
import { GetLockScreenUseCase } from './application/use-cases/get-lock-screen.use-case';
import { LoginWithPinUseCase } from './application/use-cases/login-with-pin.use-case';
import { ValidateSetupOwnerUseCase } from './application/use-cases/validate-setup-owner.use-case';
import { SetupOwnerUseCase } from './application/use-cases/setup-owner.use-case';
import { CheckSetupAvailableUseCase } from './application/use-cases/check-setup-available.use-case';
import { TouchSessionUseCase } from './application/use-cases/touch-session.use-case';
import { SwitchShopUseCase } from './application/use-cases/switch-shop.use-case';
import {
  CompleteWhatsappOtpLoginUseCase,
  RequestWhatsappOtpUseCase,
  VerifyWhatsappOtpUseCase,
} from './application/use-cases/whatsapp-otp.use-cases';
import { UserSessionRepository } from './domain/repositories/user-session.repository';
import { OtpChallengeRepository } from './domain/repositories/otp-challenge.repository';
import { MembershipResolverService } from './domain/services/membership-resolver.service';
import { AuthTokenService } from './domain/services/auth-token.service';
import { UserResolverService } from './domain/services/user-resolver.service';
import { SupabaseOtpChallengeRepository } from './infrastructure/repositories/otp-challenge.repository';
import { WhatsappOtpGateway } from './infrastructure/services/whatsapp-otp.gateway';
import { SupabaseUserSessionRepository } from './infrastructure/repositories/user-session.repository';
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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret', 'dev-change-me-in-production'),
        signOptions: {
          issuer: config.get<string>('auth.jwtIssuer', 'venteapp-api'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: UserSessionRepository, useClass: SupabaseUserSessionRepository },
    { provide: OtpChallengeRepository, useClass: SupabaseOtpChallengeRepository },
    AuthTokenService,
    UserResolverService,
    MembershipResolverService,
    WhatsappOtpGateway,
    AuthPresenter,
    GetLockScreenUseCase,
    SetupOwnerUseCase,
    ValidateSetupOwnerUseCase,
    CheckSetupAvailableUseCase,
    LoginWithPinUseCase,
    RequestWhatsappOtpUseCase,
    VerifyWhatsappOtpUseCase,
    CompleteWhatsappOtpLoginUseCase,
    EmergencyUnlockUseCase,
    EnableBiometricUseCase,
    TouchSessionUseCase,
    RefreshTokensUseCase,
    LogoutUseCase,
    ListDeviceSessionsUseCase,
    RevokeDeviceSessionUseCase,
    SwitchShopUseCase,
    SessionGuard,
  ],
  exports: [UserSessionRepository, AuthTokenService, SessionGuard, ShopsModule],
})
export class AuthModule {}
