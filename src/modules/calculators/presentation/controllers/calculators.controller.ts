import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import { TenantGuard } from '../../../tenants/tenant.guard';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { Permission } from '../../../../shared/enums/permission.enum';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import {
  GetCalculatorsStatusUseCase,
  ToggleCalculatorsUseCase,
  ListCalculatorProductsUseCase,
  UpsertCalculatorProductUseCase,
  ListCalculatorHistoryUseCase,
  CreateCalculatorHistoryUseCase,
} from '../../application/use-cases/calculators.use-cases';
import { ToggleModuleDto, UpsertProductDataDto, CreateHistoryDto } from '../dtos/calculators.dto';

@ApiTags('Calculateurs métiers')
@Controller()
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class CalculatorsController {
  constructor(
    private readonly getStatus: GetCalculatorsStatusUseCase,
    private readonly toggle: ToggleCalculatorsUseCase,
    private readonly listProducts: ListCalculatorProductsUseCase,
    private readonly upsertProduct: UpsertCalculatorProductUseCase,
    private readonly listHistory: ListCalculatorHistoryUseCase,
    private readonly createHistory: CreateCalculatorHistoryUseCase,
  ) {}

  @Get('calculators/status')
  @RequirePermissions(Permission.CALCULATORS_USE)
  @ApiOperation({ summary: 'Vérifier si le module est activé pour la boutique' })
  @ApiOkResponse({ description: 'Statut du module' })
  status(@CurrentAuth() auth: AuthContext) {
    return this.getStatus.execute(auth);
  }

  @Post('calculators/toggle')
  @RequirePermissions(Permission.SETTINGS_WRITE)
  @ApiOperation({ summary: 'Activer ou désactiver le module pour la boutique' })
  @ApiOkResponse({ description: 'Nouveau statut du module' })
  toggleModule(@CurrentAuth() auth: AuthContext, @Body() dto: ToggleModuleDto) {
    return this.toggle.execute(auth, dto.enabled);
  }

  @Get('calculator-products')
  @RequirePermissions(Permission.CALCULATORS_USE)
  @ApiOperation({ summary: 'Lister les configurations de calculateur par produit' })
  @ApiOkResponse({ description: 'Configurations produits' })
  listConfigs(@CurrentAuth() auth: AuthContext) {
    return this.listProducts.execute(auth);
  }

  @Post('calculator-products')
  @RequirePermissions(Permission.CALCULATORS_USE)
  @ApiOperation({ summary: 'Enregistrer une configuration de calculateur pour un produit' })
  @ApiCreatedResponse({ description: 'Configuration enregistrée' })
  upsertConfig(@CurrentAuth() auth: AuthContext, @Body() dto: UpsertProductDataDto) {
    return this.upsertProduct.execute(auth, dto.productId, dto.calculatorType, dto.metadata);
  }

  @Get('calculator-history')
  @RequirePermissions(Permission.CALCULATORS_HISTORY)
  @ApiOperation({ summary: 'Lister l\'historique des calculs' })
  @ApiOkResponse({ description: 'Historique des calculs' })
  history(@CurrentAuth() auth: AuthContext) {
    return this.listHistory.execute(auth);
  }

  @Post('calculator-history')
  @RequirePermissions(Permission.CALCULATORS_USE)
  @ApiOperation({ summary: 'Enregistrer un calcul dans l\'historique' })
  @ApiCreatedResponse({ description: 'Calcul enregistré' })
  addHistory(@CurrentAuth() auth: AuthContext, @Body() dto: CreateHistoryDto) {
    return this.createHistory.execute(auth, dto);
  }
}
