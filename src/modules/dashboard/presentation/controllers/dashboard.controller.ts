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
@ApiSecurity('bearer')
export class DashboardController {
  constructor(private readonly getDashboardUseCase: GetDashboardUseCase) {}

  @Get()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({
    summary: 'Synthèse du tableau de bord (journée en cours)',
    description: [
      '**Permission** : `dashboard:read`',
      '',
      '**Module 2** — KPIs du jour pour la boutique active (fuseau Bénin UTC+1).',
      '',
      '**Règles** :',
      '- RG-DB-01 : CA = somme des ventes `completed` du jour',
      '- RG-DB-02 : ventes `cancelled` exclues',
      '- RG-DB-03 : `lowStockCount` = produits non archivés avec stock <= seuil',
      '- RG-DB-04 : `debtorCount` = clients avec dette ouverte',
      '- RG-DB-05 : 5 dernières ventes du jour',
      '',
      '**Section `financial`** (bénéfice estimé, encaissements, dettes) :',
      'visible uniquement si permission `dashboard:financial` (patron).',
    ].join('\n'),
  })
  @ApiOkResponse({
    type: DashboardResponseDto,
    description: 'KPIs publics + section financière optionnelle',
  })
  @ApiUnauthorizedResponse({ description: 'Session invalide ou expirée' })
  @ApiForbiddenResponse({ description: 'Permission `dashboard:read` requise' })
  dashboard(@CurrentAuth() auth: AuthContext) {
    return this.getDashboardUseCase.execute(auth);
  }
}
