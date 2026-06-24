import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditLogRepository } from '../../domain/repositories/audit-log.repository';

@Injectable()
export class SupabaseAuditLogRepository extends AuditLogRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async save(log: AuditLog): Promise<void> {
    const { error } = await this.supabase.db.from('audit_logs').insert({
      shop_id: log.shopId,
      user_id: log.userId,
      action: log.action,
      module: log.module,
      entity_id: log.entityId,
      entity_table: log.entityTable,
      old_value: log.oldValue,
      new_value: log.newValue,
      reason: log.reason,
      created_at: nowMs(),
    });
    if (error) throw new Error(`Échec écriture audit_logs: ${error.message}`);
  }
}
