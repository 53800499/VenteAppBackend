import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import {
  AuditAccessPolicy,
  ExportAuditLogsUseCase,
  GetAuditFilterOptionsUseCase,
  GetAuditLogDetailUseCase,
  GetEntityAuditHistoryUseCase,
  ListAuditLogsUseCase,
} from './application/use-cases/audit-query.use-cases';
import { AuditPersistenceModule } from './audit-persistence.module';
import { AuditLabelService } from './domain/services/audit-label.service';
import { AuditController } from './presentation/controllers/audit.controller';

@Module({
  imports: [
    AuditPersistenceModule,
    CoreModule,
    AuthorizationGuardsModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [AuditController],
  providers: [
    AuditLabelService,
    AuditAccessPolicy,
    ListAuditLogsUseCase,
    GetAuditLogDetailUseCase,
    GetEntityAuditHistoryUseCase,
    GetAuditFilterOptionsUseCase,
    ExportAuditLogsUseCase,
  ],
  exports: [AuditPersistenceModule],
})
export class AuditModule {}
