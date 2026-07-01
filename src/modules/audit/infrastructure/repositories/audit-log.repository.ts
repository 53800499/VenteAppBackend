import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import { AuditLogEntry } from '../../domain/entities/audit-log-entry.entity';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import {
  AuditLogListFilters,
  AuditLogListResult,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';

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
    return (data ?? []).map((row) => this.toEntry(row as AuditLogRow));
  }

  async list(filters: AuditLogListFilters): Promise<AuditLogListResult> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase.db
      .from('audit_logs')
      .select('*, users(name)', { count: 'exact' })
      .eq('shop_id', filters.shopId);

    if (filters.module) query = query.eq('module', filters.module);
    if (filters.action) query = query.eq('action', filters.action);
    if (filters.userId != null) query = query.eq('user_id', filters.userId);
    if (filters.entityTable) query = query.eq('entity_table', filters.entityTable);
    if (filters.entityId != null) query = query.eq('entity_id', filters.entityId);
    if (filters.fromMs != null) query = query.gte('created_at', filters.fromMs);
    if (filters.toMs != null) query = query.lte('created_at', filters.toMs);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new BadRequestException(error.message);

    return {
      items: (data ?? []).map((row) => this.toEntry(row as AuditLogRow)),
      total: count ?? 0,
    };
  }

  async findById(shopId: number, id: number): Promise<AuditLogEntry | null> {
    const { data, error } = await this.supabase.db
      .from('audit_logs')
      .select('*, users(name)')
      .eq('shop_id', shopId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? this.toEntry(data as AuditLogRow) : null;
  }

  private toEntry(row: AuditLogRow): AuditLogEntry {
    const userRel = row.users;
    const userName = Array.isArray(userRel) ? userRel[0]?.name ?? null : userRel?.name ?? null;
    return new AuditLogEntry(
      row.id,
      row.shop_id,
      row.user_id,
      userName,
      row.action,
      row.module,
      row.entity_id,
      row.entity_table,
      row.old_value,
      row.new_value,
      row.reason,
      row.created_at,
    );
  }
}
