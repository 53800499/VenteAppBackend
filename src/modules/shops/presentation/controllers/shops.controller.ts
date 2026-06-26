import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import {
  CreateShopDto,
  DeactivateShopDto,
  SetDefaultShopResponseDto,
  ShopDetailResponseDto,
  ShopListResponseDto,
  UpdateShopDto,
} from '../../application/dto/shop-management.dto';
import {
  CreateShopUseCase,
  DeactivateShopUseCase,
  GetOwnedShopUseCase,
  ListOwnedShopsUseCase,
  SetDefaultShopUseCase,
  UpdateShopUseCase,
} from '../../application/use-cases/shop-management.use-cases';

@ApiTags('Boutiques')
@Controller('shops')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class ShopsController {
  constructor(
    private readonly listShops: ListOwnedShopsUseCase,
    private readonly getShop: GetOwnedShopUseCase,
    private readonly createShop: CreateShopUseCase,
    private readonly updateShop: UpdateShopUseCase,
    private readonly deactivateShop: DeactivateShopUseCase,
    private readonly setDefaultShop: SetDefaultShopUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.SHOPS_READ)
  @ApiOperation({
    summary: 'Lister mes boutiques',
    description: [
      '**RG-SHOP-04 / RG-SHOP-06** — Liste les boutiques dont le patron est propriétaire (`owner_user_id`).',
      'Réservé au rôle `owner` avec permission `shops:read`.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: ShopListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Session invalide' })
  @ApiForbiddenResponse({ description: 'Permission `shops:read` requise' })
  list(@CurrentAuth() auth: AuthContext) {
    return this.listShops.execute(auth);
  }

  @Get(':id')
  @RequirePermissions(Permission.SHOPS_READ)
  @ApiOperation({ summary: 'Détail d\'une boutique possédée' })
  @ApiParam({ name: 'id', example: 2 })
  @ApiOkResponse({ type: ShopDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Boutique introuvable' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getShop.execute(auth, id);
  }

  @Post()
  @RequirePermissions(Permission.SHOPS_CREATE)
  @ApiOperation({
    summary: 'Créer une boutique',
    description: '**UC-20** — Crée une boutique vide (catalogue à initialiser). Permission `shops:create`.',
  })
  @ApiCreatedResponse({ type: ShopDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Permission `shops:create` requise' })
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateShopDto) {
    return this.createShop.execute(auth, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SHOPS_UPDATE)
  @ApiOperation({ summary: 'Modifier une boutique', description: 'Permission `shops:update`.' })
  @ApiParam({ name: 'id', example: 2 })
  @ApiOkResponse({ type: ShopDetailResponseDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShopDto,
  ) {
    return this.updateShop.execute(auth, id, dto);
  }

  @Patch(':id/deactivate')
  @RequirePermissions(Permission.SHOPS_DEACTIVATE)
  @ApiOperation({
    summary: 'Désactiver une boutique',
    description: [
      '**RG-SHOP-08** — Soft-close : historique conservé, absente du sélecteur actif.',
      'Impossible de désactiver la dernière boutique active.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 2 })
  @ApiOkResponse({ description: 'Boutique désactivée' })
  deactivate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeactivateShopDto,
  ) {
    return this.deactivateShop.execute(auth, id, dto.reason);
  }

  @Post(':id/set-default')
  @RequirePermissions(Permission.SHOPS_SWITCH)
  @ApiOperation({
    summary: 'Définir la boutique par défaut',
    description: 'Marque cette boutique comme `is_default` pour les prochains logins.',
  })
  @ApiParam({ name: 'id', example: 2 })
  @ApiOkResponse({ type: SetDefaultShopResponseDto })
  setDefault(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.setDefaultShop.execute(auth, id);
  }
}
