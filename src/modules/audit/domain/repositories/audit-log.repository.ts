import { AuditLog } from '../entities/audit-log.entity';

export abstract class AuditLogRepository {
  abstract save(log: AuditLog): Promise<void>;
}
