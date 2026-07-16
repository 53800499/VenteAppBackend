import { Controller, Get, Param, ParseIntPipe, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiForbiddenResponse,
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
  InventoryLotResponseDto,
  ListInventoryLotsQueryDto,
  ListInventoryLotsUseCase,
  ListProductInventoryLotsUseCase,
} from '../../application/use-cases/inventory-lot.use-cases';

@ApiTags('Inventaire — Lots')
@Controller('inventory/lots')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class InventoryLotsController {
  constructor(
    private readonly listLots: ListInventoryLotsUseCase,
    private readonly listProductLots: ListProductInventoryLotsUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({
    summary: 'Lister les lots de stock (sync / audit FIFO)',
    description: [
      '**Permission** : `inventory:read`',
      '',
      'Retourne tous les lots de la boutique, optionnellement filtrés par `productId`.',
      'Utilisé par la sync mobile pour aligner le stock FIFO multi-appareils.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [InventoryLotResponseDto] })
  @ApiForbiddenResponse({ description: 'Permission `inventory:read` requise' })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListInventoryLotsQueryDto) {
    return this.listLots.execute(auth, query.productId);
  }

  @Get('by-product/:productId')
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @ApiParam({ name: 'productId', example: 12 })
  @ApiOperation({
    summary: 'Lots actifs d\'un produit (FIFO)',
    description: '**Permission** : `inventory:write` — coûts d\'achat par lot (patron/gestionnaire).',
  })
  @ApiOkResponse({ type: [InventoryLotResponseDto] })
  byProduct(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.listProductLots.execute(auth, productId);
  }
}
