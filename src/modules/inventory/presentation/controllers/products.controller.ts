import {
  Body,
  Controller,
  Delete,
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
  ApiBadRequestResponse,
  ApiConflictResponse,
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
  ArchiveProductResponseDto,
  CreateProductDto,
  CreateProductResponseDto,
  DeleteProductResponseDto,
  ListProductsQueryDto,
  ProductResponseDto,
  StockAdjustmentDto,
  StockAdjustmentResponseDto,
  StockMovementResponseDto,
  UpdateProductDto,
  UpdateProductResponseDto,
} from '../../application/dto/product.dto';
import {
  ArchiveProductUseCase,
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListLowStockProductsUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from '../../application/use-cases/product.use-cases';
import {
  AdjustProductStockUseCase,
  ListProductStockMovementsUseCase,
} from '../../application/use-cases/stock.use-cases';

@ApiTags('Inventaire — Produits')
@Controller('products')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class ProductsController {
  constructor(
    private readonly listProducts: ListProductsUseCase,
    private readonly listLowStock: ListLowStockProductsUseCase,
    private readonly getProduct: GetProductUseCase,
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly archiveProduct: ArchiveProductUseCase,
    private readonly deleteProduct: DeleteProductUseCase,
    private readonly adjustStock: AdjustProductStockUseCase,
    private readonly listMovements: ListProductStockMovementsUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({
    summary: 'Lister les produits du catalogue',
    description: [
      '**Permission** : `inventory:read`',
      '',
      '**Filtres** (query) :',
      '- `categoryId` — produits d\'une catégorie',
      '- `search` — recherche nom ou SKU',
      '- `lowStock=true` — stock <= seuil d\'alerte',
      '- `includeArchived=true` — inclure archivés (défaut : exclus, RG-INV-08)',
      '- `sort` — `name` | `stock` | `price`',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [ProductResponseDto] })
  @ApiForbiddenResponse({ description: 'Permission `inventory:read` requise' })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListProductsQueryDto) {
    return this.listProducts.execute(auth, query);
  }

  @Get('low-stock')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({
    summary: 'Produits en alerte stock',
    description: [
      '**Permission** : `inventory:read`',
      '',
      'Équivalent à `GET /products?lowStock=true`, triés par stock croissant.',
      'Point d\'entrée depuis le badge `lowStockCount` du tableau de bord (RG-DB-03).',
      '',
      'Seuil = `alert_threshold` du produit, ou défaut boutique (5 FCFA unités).',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [ProductResponseDto] })
  lowStock(@CurrentAuth() auth: AuthContext) {
    return this.listLowStock.execute(auth);
  }

  @Get(':id')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiParam({ name: 'id', example: 12 })
  @ApiOperation({
    summary: 'Fiche produit',
    description: '**Permission** : `inventory:read` — Détail complet avec indicateur `isLowStock`.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Produit introuvable (INV_PRODUCT_NOT_FOUND)' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getProduct.execute(auth, id);
  }

  @Post()
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @ApiOperation({
    summary: 'Créer un produit (UC-03)',
    description: [
      '**Permission** : `inventory:write`',
      '',
      '**Règles** :',
      '- Nom min. 2 caractères (RG-INV-01)',
      '- Prix vente > 0 FCFA entier (RG-INV-02)',
      '- Prix achat optionnel, < prix vente (RG-INV-03)',
      '- Catégorie active obligatoire (RG-INV-05)',
      '- Seuil alerte défaut 5 (RG-INV-06)',
      '',
      'Si `initialQuantity > 0`, crée un mouvement `initial` dans `stock_movements`.',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: CreateProductResponseDto })
  @ApiBadRequestResponse({ description: 'Validation prix, nom ou catégorie inactive' })
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateProductDto) {
    return this.createProduct.execute(auth, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @ApiParam({ name: 'id', example: 12 })
  @ApiOperation({
    summary: 'Modifier un produit',
    description: [
      '**Permission** : `inventory:write`',
      '',
      'Modification partielle (tous les champs optionnels).',
      'Changement de `priceSell` ou `priceBuy` → audit `product_price_changed` (RG-INV-13).',
      'Les ventes passées conservent leurs snapshots de prix (RG-INV-09).',
      'Produit archivé : modification refusée.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: UpdateProductResponseDto })
  @ApiNotFoundResponse({ description: 'Produit introuvable' })
  @ApiConflictResponse({ description: 'Produit déjà archivé' })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.updateProduct.execute(auth, id, dto);
  }

  @Patch(':id/archive')
  @RequirePermissions(Permission.INVENTORY_ARCHIVE)
  @ApiParam({ name: 'id', example: 12 })
  @ApiOperation({
    summary: 'Archiver un produit',
    description: [
      '**Permission** : `inventory:archive`',
      '',
      'Soft-delete : `is_archived = true` (RG-INV-07/08).',
      '**Toujours autorisé**, même si le produit a des ventes.',
      'Le produit disparaît du catalogue actif mais reste dans l\'historique des ventes.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: ArchiveProductResponseDto })
  @ApiNotFoundResponse({ description: 'Produit introuvable' })
  @ApiConflictResponse({ description: 'Déjà archivé' })
  archive(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.archiveProduct.execute(auth, id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.INVENTORY_ARCHIVE)
  @ApiParam({ name: 'id', example: 12 })
  @ApiOperation({
    summary: 'Supprimer définitivement un produit',
    description: [
      '**Permission** : `inventory:archive`',
      '',
      '**RG-INV-07** — Suppression physique autorisée uniquement si **aucune ligne de vente** (`sale_items`) n\'est liée.',
      'Si des ventes existent → erreur `INV_PRODUCT_DELETE_HAS_SALES` ; utilisez `PATCH :id/archive`.',
      '',
      'Les mouvements de stock (`stock_movements`) sont supprimés en cascade.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: DeleteProductResponseDto })
  @ApiNotFoundResponse({ description: 'Produit introuvable' })
  @ApiConflictResponse({ description: 'Produit lié à des ventes — archiver à la place' })
  remove(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.deleteProduct.execute(auth, id);
  }

  @Post(':id/stock-adjustments')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @ApiParam({ name: 'id', example: 12 })
  @ApiOperation({
    summary: 'Ajuster le stock (UC-04)',
    description: [
      '**Permission** : `inventory:adjust`',
      '',
      '**Types** :',
      '- `restock` — entrée (+quantityChange), coût unitaire optionnel (RG-INV-12)',
      '- `loss` — perte/vol (quantityChange négatif), motif obligatoire',
      '- `adjustment` — correction inventaire, motif obligatoire (RG-INV-10)',
      '',
      'Stock jamais négatif (RG-INV-11). Audit `stock_adjusted` enregistré.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: StockAdjustmentResponseDto })
  @ApiBadRequestResponse({ description: 'Stock insuffisant, motif manquant ou validation' })
  @ApiNotFoundResponse({ description: 'Produit introuvable ou archivé' })
  adjust(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StockAdjustmentDto,
  ) {
    return this.adjustStock.execute(auth, id, dto);
  }

  @Get(':id/stock-movements')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiParam({ name: 'id', example: 12 })
  @ApiOperation({
    summary: 'Historique des mouvements de stock',
    description: [
      '**Permission** : `inventory:read`',
      '',
      'Retourne les **10 derniers** mouvements du produit (ECR-03).',
      'Types possibles : `initial`, `restock`, `loss`, `adjustment`, `sale`, `sale_cancel`, `return`.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [StockMovementResponseDto] })
  @ApiNotFoundResponse({ description: 'Produit introuvable' })
  movements(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.listMovements.execute(auth, id);
  }
}
