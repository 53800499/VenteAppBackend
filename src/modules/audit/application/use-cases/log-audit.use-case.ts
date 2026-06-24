import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditLogRepository } from '../../domain/repositories/audit-log.repository';

export interface LogAuditCommand {
  shopId: number;
  userId: number;
  action: AuditAction | string;
  module: AuditModule | string;
  entityId: number;
  entityTable: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
}

@Injectable()
export class LogAuditUseCase {
  constructor(private readonly auditLogs: AuditLogRepository) {}

  async execute(command: LogAuditCommand): Promise<void> {
    const log = new AuditLog(
      command.shopId,
      command.userId,
      command.action,
      command.module,
      command.entityId,
      command.entityTable,
      command.oldValue ?? null,
      command.newValue ?? null,
      command.reason ?? null,
    );
    await this.auditLogs.save(log);
  }
}
