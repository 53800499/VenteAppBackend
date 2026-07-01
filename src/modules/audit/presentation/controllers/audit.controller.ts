import { Controller, Get, Param, ParseIntPipe, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { Permission } from '../../../../shared/enums/permission.enum';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantGuard } from '../../../tenants/tenant.guard';
import {
  AuditEntityHistoryResponseDto,
  AuditExportResponseDto,
  AuditFilterOptionsResponseDto,
  AuditLogDetailDto,
  AuditLogListResponseDto,
  ExportAuditLogsQueryDto,
  ListAuditLogsQueryDto,
} from '../../application/dto/audit.dto';
import {
  ExportAuditLogsUseCase,
  GetAuditFilterOptionsUseCase,
  GetAuditLogDetailUseCase,
  GetEntityAuditHistoryUseCase,
  ListAuditLogsUseCase,
} from '../../application/use-cases/audit-query.use-cases';

@ApiTags('Audit & Journal')
@Controller('audit')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class AuditController {
  constructor(
    private readonly listLogs: ListAuditLogsUseCase,
    private readonly getDetail: GetAuditLogDetailUseCase,
    private readonly getEntityHistory: GetEntityAuditHistoryUseCase,
    private readonly getFilterOptions: GetAuditFilterOptionsUseCase,
    private readonly exportLogs: ExportAuditLogsUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({
    summary: 'Journal des actions sensibles (Module 12)',
    description: [
      '**RG-AUD-01** : patron uniquement (`audit:read`).',
      '**RG-AUD-04** : utilisateur, date, action, motif, avant/après.',
      '**RG-AUD-05** : filtres module, utilisateur, période, action.',
      'Entrées **permanentes** — aucune suppression (RG-AUD-02).',
    ].join('\n'),
  })
  @ApiOkResponse({ type: AuditLogListResponseDto })
  @ApiForbiddenResponse({ description: 'Réservé au patron' })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListAuditLogsQueryDto) {
    return this.listLogs.execute(auth, query);
  }

  @Get('filters')
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Options de filtrage (modules et actions)' })
  @ApiOkResponse({ type: AuditFilterOptionsResponseDto })
  filters(@CurrentAuth() auth: AuthContext) {
    return this.getFilterOptions.execute(auth);
  }

  @Get('export')
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({
    summary: 'Exporter le journal (UC-22)',
    description: 'Retourne jusqu\'à 5000 entrées en JSON pour génération PDF côté mobile (RG-AUD-07).',
  })
  @ApiOkResponse({ type: AuditExportResponseDto })
  export(@CurrentAuth() auth: AuthContext, @Query() query: ExportAuditLogsQueryDto) {
    return this.exportLogs.execute(auth, query);
  }

  @Get('entities/:entityTable/:entityId')
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({
    summary: 'Historique audit d\'une entité (RG-AUD-06)',
    description: 'Timeline chronologique pour une dette, produit, client, etc.',
  })
  @ApiParam({ name: 'entityTable', example: 'debts' })
  @ApiParam({ name: 'entityId', example: 12 })
  @ApiOkResponse({ type: AuditEntityHistoryResponseDto })
  entityHistory(
    @CurrentAuth() auth: AuthContext,
    @Param('entityTable') entityTable: string,
    @Param('entityId', ParseIntPipe) entityId: number,
  ) {
    return this.getEntityHistory.execute(auth, entityTable, entityId);
  }

  @Get(':id')
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Détail d\'une entrée d\'audit' })
  @ApiParam({ name: 'id', example: 42 })
  @ApiOkResponse({ type: AuditLogDetailDto })
  @ApiNotFoundResponse()
  detail(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getDetail.execute(auth, id);
  }
}
