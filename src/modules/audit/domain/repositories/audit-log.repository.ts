import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogEntry } from '../entities/audit-log-entry.entity';

export abstract class AuditLogRepository {
  abstract save(log: AuditLog): Promise<void>;
  abstract listByEntity(shopId: number, entityTable: string, entityId: number): Promise<AuditLogEntry[]>;
}
