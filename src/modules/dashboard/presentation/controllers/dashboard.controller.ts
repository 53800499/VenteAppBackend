import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { Permission } from '../../../../shared/enums/permission.enum';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantGuard } from '../../../tenants/tenant.guard';
import { DashboardResponseDto } from '../../application/dto/dashboard-response.dto';
import { GetDashboardUseCase } from '../../application/use-cases/get-dashboard.use-case';

@ApiTags('Tableau de bord')
@Controller('dashboard')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('session-token')
@ApiSecurity('user-id')
export class DashboardController {
  constructor(private readonly getDashboardUseCase: GetDashboardUseCase) {}

  @Get()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({
    summary: 'Synthèse du tableau de bord (journée en cours)',
    description: [
      '**Module 2** — KPIs du jour pour la boutique active (RG-DB-01 à RG-DB-06).',
      '- Ventes annulées exclues (RG-DB-02)',
      '- Données financières détaillées si permission `dashboard:financial`',
    ].join('\n'),
  })
  @ApiOkResponse({ type: DashboardResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  dashboard(@CurrentAuth() auth: AuthContext) {
    return this.getDashboardUseCase.execute(auth);
  }
}
