import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditPersistenceModule } from '../audit/audit-persistence.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import {
  GetSettingsUseCase,
  RecordBackupUseCase,
  UpdateSettingsUseCase,
  UpdateSyncSettingsUseCase,
} from './application/use-cases/settings.use-cases';
import { SettingsRegistryService } from './domain/services/settings-registry.service';
import { SettingsScopeResolverService } from './domain/services/settings-scope-resolver.service';
import { SettingsValidationService } from './domain/services/settings-validation.service';
import { SettingsController } from './presentation/controllers/settings.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    AuditPersistenceModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [SettingsController],
  providers: [
    SettingsValidationService,
    SettingsRegistryService,
    SettingsScopeResolverService,
    GetSettingsUseCase,
    UpdateSettingsUseCase,
    RecordBackupUseCase,
    UpdateSyncSettingsUseCase,
  ],
  exports: [
    SettingsRegistryService,
    SettingsScopeResolverService,
  ],
})
export class SettingsModule {}
