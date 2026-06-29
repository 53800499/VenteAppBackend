import { Module } from '@nestjs/common';
import { LogAuditUseCase } from './application/use-cases/log-audit.use-case';
import { AuditLogRepository } from './domain/repositories/audit-log.repository';
import { SupabaseAuditLogRepository } from './infrastructure/repositories/audit-log.repository';

@Module({
  providers: [
    { provide: AuditLogRepository, useClass: SupabaseAuditLogRepository },
    LogAuditUseCase,
  ],
  exports: [LogAuditUseCase, AuditLogRepository],
})
export class AuditModule {}
