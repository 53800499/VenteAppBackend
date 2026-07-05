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
import {
  GetSalesAnalysisQueryDto,
  SalesAnalysisResponseDto,
} from '../../application/dto/sales-analysis.dto';
import { GetSalesAnalysisUseCase } from '../../application/use-cases/get-sales-analysis.use-case';

@ApiTags('Analyse des ventes')
@Controller('sales-analysis')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class SalesAnalysisController {
  constructor(private readonly getSalesAnalysis: GetSalesAnalysisUseCase) {}

  @Get()
  @RequirePermissions(Permission.REPORTS_READ)
  @ApiOperation({
    summary: 'Analyse des ventes sur une période',
    description: [
      '**Permission** : `reports:read`',
      '',
      'Agrégations : catégories, écarts de prix, tendances journalières.',
      'Section `margins` : `reports:financial` (marges estimées).',
      'Ventes annulées exclues.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: SalesAnalysisResponseDto })
  @ApiForbiddenResponse({ description: 'Permission refusée' })
  analysis(@CurrentAuth() auth: AuthContext, @Query() query: GetSalesAnalysisQueryDto) {
    return this.getSalesAnalysis.execute(auth, query);
  }
}
