import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { LicenseSignerService } from '../licensing/domain/services/license-signer.service';
import { TenantDatabaseService } from '../tenants/tenant-database.service';
import { AuthTokenService } from '../auth/domain/services/auth-token.service';
import { AdminGuard } from '../../shared/guards/admin.guard';
import { AdminAuthController } from './presentation/controllers/admin-auth.controller';
import { AdminDashboardController } from './presentation/controllers/admin-dashboard.controller';
import { AdminTenantsController } from './presentation/controllers/admin-tenants.controller';
import { AdminSubscriptionsController } from './presentation/controllers/admin-subscriptions.controller';
import { AdminPaymentsController } from './presentation/controllers/admin-payments.controller';
import { AdminDevicesController } from './presentation/controllers/admin-devices.controller';
import { AdminSyncController } from './presentation/controllers/admin-sync.controller';
import { AdminAuditController } from './presentation/controllers/admin-audit.controller';
import { AdminUsersController } from './presentation/controllers/admin-users.controller';
import { AdminUserService } from './domain/services/admin-user.service';
import { AdminUserRepository } from './infrastructure/repositories/admin-user.repository';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret', 'arike_dev_secret_jwt_key_2026'),
        signOptions: {
          expiresIn: config.get<number>('auth.jwtAccessTtlSeconds', 28800),
          issuer: config.get<string>('auth.jwtIssuer', 'arike-backoffice'),
        },
      }),
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminTenantsController,
    AdminSubscriptionsController,
    AdminPaymentsController,
    AdminDevicesController,
    AdminSyncController,
    AdminAuditController,
    AdminUsersController,
  ],
  providers: [
    LicenseSignerService,
    TenantDatabaseService,
    AdminGuard,
    AdminUserRepository,
    AdminUserService,
    {
      provide: AuthTokenService,
      useFactory: (jwtService: JwtService, config: ConfigService) => {
        return new AuthTokenService(jwtService, {} as any, config);
      },
      inject: [JwtService, ConfigService],
    },
  ],
  exports: [AdminGuard, AdminUserService],
})
export class AdminModule {}
