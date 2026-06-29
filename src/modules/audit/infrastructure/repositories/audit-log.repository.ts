import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import { AuditLogEntry } from '../../domain/entities/audit-log-entry.entity';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditLogRepository } from '../../domain/repositories/audit-log.repository';

interface AuditLogRow {
  id: number;
  shop_id: number;
  user_id: number;
  action: string;
  module: string;
  entity_id: number;
  entity_table: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: number;
  users?: { name: string } | { name: string }[] | null;
}

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

  async listByEntity(shopId: number, entityTable: string, entityId: number): Promise<AuditLogEntry[]> {
    const { data, error } = await this.supabase.db
      .from('audit_logs')
      .select('*, users(name)')
      .eq('shop_id', shopId)
      .eq('entity_table', entityTable)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Échec lecture audit_logs: ${error.message}`);

    return (data ?? []).map((row) => {
      const typed = row as AuditLogRow;
      const userRel = typed.users;
      const userName = Array.isArray(userRel) ? userRel[0]?.name ?? null : userRel?.name ?? null;
      return new AuditLogEntry(
        typed.id,
        typed.shop_id,
        typed.user_id,
        userName,
        typed.action,
        typed.module,
        typed.entity_id,
        typed.entity_table,
        typed.old_value,
        typed.new_value,
        typed.reason,
        typed.created_at,
      );
    });
  }
}
