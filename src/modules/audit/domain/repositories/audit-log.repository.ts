import { AuditLogEntry } from '../entities/audit-log-entry.entity';

export interface AuditLogListFilters {
  shopId: number;
  module?: string;
  action?: string;
  userId?: number;
  entityTable?: string;
  entityId?: number;
  fromMs?: number;
  toMs?: number;
  page?: number;
  limit?: number;
}

export interface AuditLogListResult {
  items: AuditLogEntry[];
  total: number;
}

export abstract class AuditLogRepository {
  abstract save(log: import('../entities/audit-log.entity').AuditLog): Promise<void>;
  abstract listByEntity(shopId: number, entityTable: string, entityId: number): Promise<AuditLogEntry[]>;
  abstract list(filters: AuditLogListFilters): Promise<AuditLogListResult>;
  abstract findById(shopId: number, id: number): Promise<AuditLogEntry | null>;
}
