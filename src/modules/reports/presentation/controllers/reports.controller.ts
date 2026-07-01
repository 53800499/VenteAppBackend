import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
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
import { GetReportQueryDto, ReportResponseDto } from '../../application/dto/report.dto';
import { GetReportUseCase } from '../../application/use-cases/get-report.use-case';

@ApiTags('Statistiques & Rapports')
@Controller('reports')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class ReportsController {
  constructor(private readonly getReport: GetReportUseCase) {}

  @Get()
  @RequirePermissions(Permission.REPORTS_READ)
  @ApiOperation({
    summary: 'Rapport d\'activité sur une période (Module 8)',
    description: [
      '**Permission** : `reports:read`',
      '',
      'Indicateurs V1 : CA brut, CA encaissé, crédit, panier moyen, top produits, taux recouvrement.',
      'Section `financial` : `reports:financial` (bénéfice estimé RG-STAT-02).',
      'V2 : `sellerPerformance` — CA par vendeur.',
      'V3 : `?consolidated=true` — agrégation multi-boutiques (patron + `shops:consolidated_read`).',
      '',
      'RG-STAT-01 : ventes annulées exclues. RG-STAT-05 : `empty` si aucune vente.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: ReportResponseDto })
  @ApiForbiddenResponse({ description: 'Vue consolidée refusée' })
  report(@CurrentAuth() auth: AuthContext, @Query() query: GetReportQueryDto) {
    return this.getReport.execute(auth, query);
  }
}
