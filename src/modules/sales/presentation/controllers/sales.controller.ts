import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
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
  CancelSaleDto,
  CreateQuickSaleDto,
  CreateStandardSaleDto,
  ListSalesQueryDto,
  SaleListItemDto,
  SaleResponseDto,
} from '../../application/dto/sale.dto';
import {
  CancelSaleUseCase,
  CreateQuickSaleUseCase,
  CreateStandardSaleUseCase,
  GetSaleUseCase,
  ListSalesUseCase,
} from '../../application/use-cases/sale.use-cases';

@ApiTags('Ventes')
@Controller('sales')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class SalesController {
  constructor(
    private readonly createStandardSale: CreateStandardSaleUseCase,
    private readonly createQuickSale: CreateQuickSaleUseCase,
    private readonly listSales: ListSalesUseCase,
    private readonly getSale: GetSaleUseCase,
    private readonly cancelSale: CancelSaleUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.SALES_READ)
  @ApiOperation({ summary: 'Lister les ventes de la boutique', description: '**Permission** : `sales:read`' })
  @ApiOkResponse({ type: [SaleListItemDto] })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListSalesQueryDto) {
    return this.listSales.execute(auth, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.SALES_READ)
  @ApiOperation({ summary: 'Détail d\'une vente avec lignes' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: SaleResponseDto })
  @ApiNotFoundResponse({ description: 'Vente introuvable' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getSale.execute(auth, id);
  }

  @Post()
  @RequirePermissions(Permission.SALES_CREATE)
  @ApiOperation({
    summary: 'Enregistrer une vente standard (UC-05)',
    description: [
      '**Permission** : `sales:create`',
      '',
      'RG-VTE-01 à 08 : panier produits, remise, paiement, décrément stock atomique, reçu REC-YYYYMMDD-NNNN.',
      'Client obligatoire si crédit > 0 (RG-VTE-06).',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: SaleResponseDto })
  createStandard(@CurrentAuth() auth: AuthContext, @Body() dto: CreateStandardSaleDto) {
    return this.createStandardSale.execute(auth, dto);
  }

  @Post('quick')
  @RequirePermissions(Permission.SALES_CREATE)
  @ApiOperation({
    summary: 'Enregistrer une vente rapide (RG-VTE-09)',
    description: 'Montant global sans produits — n\'affecte pas le stock (RG-VTE-10). Crédit interdit (RG-VTE-12).',
  })
  @ApiCreatedResponse({ type: SaleResponseDto })
  createQuick(@CurrentAuth() auth: AuthContext, @Body() dto: CreateQuickSaleDto) {
    return this.createQuickSale.execute(auth, dto);
  }

  @Patch(':id/cancel')
  @RequirePermissions(Permission.SALES_CANCEL)
  @ApiOperation({
    summary: 'Annuler une vente (UC-07)',
    description: [
      '**Permission** : `sales:cancel` — **Patron uniquement** (RG-VTE-18)',
      '',
      'Fenêtre 24h (RG-VTE-13), motif obligatoire 5+ caractères (RG-VTE-14).',
      'Restitution stock si vente standard (RG-VTE-15).',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ description: 'Vente annulée' })
  @ApiForbiddenResponse({ description: 'Patron requis, fenêtre expirée ou dette partiellement remboursée' })
  cancel(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelSaleDto,
  ) {
    return this.cancelSale.execute(auth, id, dto.reason);
  }
}
