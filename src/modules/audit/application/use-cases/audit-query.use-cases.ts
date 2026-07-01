import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { AuditLogEntry } from '../../domain/entities/audit-log-entry.entity';
import { AuditLogListFilters, AuditLogRepository } from '../../domain/repositories/audit-log.repository';
import { AuditLabelService } from '../../domain/services/audit-label.service';
import { ExportAuditLogsQueryDto, ListAuditLogsQueryDto } from '../dto/audit.dto';

const EXPORT_MAX_ENTRIES = 5000;

@Injectable()
export class AuditAccessPolicy {
  assertOwnerAccess(auth: AuthContext): void {
    if (auth.role !== UserRole.OWNER) {
      throw new ForbiddenException(
        'Le journal d\'audit est réservé au patron (RG-AUD-01).',
      );
    }
  }
}

function toListItem(entry: AuditLogEntry, labels: AuditLabelService) {
  return {
    id: entry.id,
    action: entry.action,
    actionLabel: labels.actionLabel(entry.action),
    module: entry.module,
    moduleLabel: labels.moduleLabel(entry.module),
    userId: entry.userId,
    userName: entry.userName,
    entityId: entry.entityId,
    entityTable: entry.entityTable,
    reason: entry.reason,
    createdAt: entry.createdAt,
    hasDiff: entry.oldValue != null || entry.newValue != null,
  };
}

function toDetail(entry: AuditLogEntry, labels: AuditLabelService) {
  return {
    ...toListItem(entry, labels),
    oldValue: entry.oldValue,
    newValue: entry.newValue,
  };
}

@Injectable()
export class ListAuditLogsUseCase {
  constructor(
    private readonly auditLogs: AuditLogRepository,
    private readonly labels: AuditLabelService,
    private readonly access: AuditAccessPolicy,
  ) {}

  async execute(auth: AuthContext, query: ListAuditLogsQueryDto) {
    this.access.assertOwnerAccess(auth);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const filters: AuditLogListFilters = {
      shopId: auth.shopId,
      module: query.module,
      action: query.action,
      userId: query.userId,
      entityTable: query.entityTable,
      entityId: query.entityId,
      fromMs: query.from,
      toMs: query.to,
      page,
      limit,
    };

    const result = await this.auditLogs.list(filters);

    return {
      items: result.items.map((entry) => toListItem(entry, this.labels)),
      pagination: {
        page,
        limit,
        total: result.total,
        hasMore: page * limit < result.total,
      },
    };
  }
}

@Injectable()
export class GetAuditLogDetailUseCase {
  constructor(
    private readonly auditLogs: AuditLogRepository,
    private readonly labels: AuditLabelService,
    private readonly access: AuditAccessPolicy,
  ) {}

  async execute(auth: AuthContext, id: number) {
    this.access.assertOwnerAccess(auth);

    const entry = await this.auditLogs.findById(auth.shopId, id);
    if (!entry) {
      throw new NotFoundException('Entrée d\'audit introuvable.');
    }
    return toDetail(entry, this.labels);
  }
}

@Injectable()
export class GetEntityAuditHistoryUseCase {
  constructor(
    private readonly auditLogs: AuditLogRepository,
    private readonly labels: AuditLabelService,
    private readonly access: AuditAccessPolicy,
  ) {}

  async execute(auth: AuthContext, entityTable: string, entityId: number) {
    this.access.assertOwnerAccess(auth);

    const timeline = await this.auditLogs.listByEntity(auth.shopId, entityTable, entityId);

    return {
      entityTable,
      entityId,
      timeline: timeline.map((entry) => toDetail(entry, this.labels)),
    };
  }
}

@Injectable()
export class GetAuditFilterOptionsUseCase {
  constructor(
    private readonly labels: AuditLabelService,
    private readonly access: AuditAccessPolicy,
  ) {}

  execute(auth: AuthContext) {
    this.access.assertOwnerAccess(auth);
    return this.labels.listFilterOptions();
  }
}

@Injectable()
export class ExportAuditLogsUseCase {
  constructor(
    private readonly auditLogs: AuditLogRepository,
    private readonly labels: AuditLabelService,
    private readonly access: AuditAccessPolicy,
  ) {}

  async execute(auth: AuthContext, query: ExportAuditLogsQueryDto) {
    this.access.assertOwnerAccess(auth);

    const result = await this.auditLogs.list({
      shopId: auth.shopId,
      module: query.module,
      action: query.action,
      userId: query.userId,
      entityTable: query.entityTable,
      entityId: query.entityId,
      fromMs: query.from,
      toMs: query.to,
      page: 1,
      limit: EXPORT_MAX_ENTRIES,
    });

    return {
      exportedAt: Date.now(),
      shopId: auth.shopId,
      total: result.total,
      entries: result.items.map((entry) => toDetail(entry, this.labels)),
      pdfHint:
        result.total > EXPORT_MAX_ENTRIES
          ? `Export tronqué à ${EXPORT_MAX_ENTRIES} entrées. Affinez les filtres pour un export complet.`
          : 'Générez le PDF côté mobile à partir de ces données (UC-22).',
    };
  }
}
