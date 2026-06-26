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
  ApiQuery,
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
  CategoryResponseDto,
  CreateCategoryDto,
  DeleteCategoryResponseDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from '../../application/dto/category.dto';
import {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
} from '../../application/use-cases/category.use-cases';

@ApiTags('Inventaire — Catégories')
@Controller('categories')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class CategoriesController {
  constructor(
    private readonly listCategories: ListCategoriesUseCase,
    private readonly createCategory: CreateCategoryUseCase,
    private readonly updateCategory: UpdateCategoryUseCase,
    private readonly deleteCategory: DeleteCategoryUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({
    summary: 'Lister les catégories de la boutique',
    description: [
      '**Permission** : `inventory:read`',
      '',
      'Retourne les catégories triées par `sortOrder` puis nom.',
      'Utilisé pour les filtres chips de l\'écran catalogue (ECR-02).',
      '',
      'Query `activeOnly=true` : uniquement les catégories actives (requis pour assigner un produit — RG-INV-05).',
    ].join('\n'),
  })
  @ApiQuery({ name: 'activeOnly', required: false, example: 'true', description: 'Filtrer les catégories actives' })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Session invalide' })
  @ApiForbiddenResponse({ description: 'Permission `inventory:read` requise' })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListCategoriesQueryDto) {
    return this.listCategories.execute(auth, query.activeOnly === 'true');
  }

  @Post()
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @ApiOperation({
    summary: 'Créer une catégorie',
    description: [
      '**Permission** : `inventory:write`',
      '',
      'Le nom doit être unique par boutique.',
      'Réservé au patron (`owner`) — les vendeurs ont `inventory:read` uniquement.',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiConflictResponse({ description: 'Nom de catégorie déjà utilisé (INV_CATEGORY_NAME_CONFLICT)' })
  @ApiBadRequestResponse({ description: 'Nom invalide' })
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateCategoryDto) {
    return this.createCategory.execute(auth, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @ApiParam({ name: 'id', example: 1, description: 'ID de la catégorie' })
  @ApiOperation({
    summary: 'Modifier une catégorie',
    description: [
      '**Permission** : `inventory:write`',
      '',
      'Champs modifiables : `name`, `isActive`, `sortOrder`.',
      'Désactiver une catégorie (`isActive: false`) empêche son utilisation pour de nouveaux produits.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Catégorie introuvable (INV_CATEGORY_NOT_FOUND)' })
  @ApiConflictResponse({ description: 'Nom déjà utilisé' })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.updateCategory.execute(auth, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.INVENTORY_WRITE)
  @ApiParam({ name: 'id', example: 1 })
  @ApiOperation({
    summary: 'Supprimer une catégorie',
    description: [
      '**Permission** : `inventory:write`',
      '',
      'Suppression physique autorisée **uniquement** si aucun produit n\'est rattaché.',
      'Si des produits existent → erreur `INV_CATEGORY_HAS_PRODUCTS`.',
      'Alternative : désactiver via `PATCH` avec `isActive: false`.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: DeleteCategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Catégorie introuvable' })
  @ApiConflictResponse({ description: 'Catégorie contient des produits' })
  remove(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.deleteCategory.execute(auth, id);
  }
}
