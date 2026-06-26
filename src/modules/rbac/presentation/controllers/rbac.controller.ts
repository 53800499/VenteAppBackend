import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import { TenantGuard } from '../../../tenants/tenant.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import {
  CreatePermissionOverrideDto,
  CreateShopRoleDto,
  ReplaceUserPermissionOverridesDto,
  SetRolePermissionsDto,
  UpdateShopRoleDto,
} from '../../application/dto/rbac-management.dto';
import {
  CheckPermissionResponseDto,
  MyPermissionsResponseDto,
  PermissionsCatalogResponseDto,
  RoleCatalogItemDto,
  RoleDetailResponseDto,
  RolesCatalogResponseDto,
  UserEffectivePermissionsResponseDto,
  UserOverridesResponseDto,
  UserPermissionOverridesReplaceResponseDto,
} from '../../application/dto/rbac-response.dto';
import {
  CreateShopRoleUseCase,
  CreateUserOverrideUseCase,
  DeleteShopRoleUseCase,
  GetUserEffectivePermissionsUseCase,
  ListUserOverridesUseCase,
  RemoveUserOverrideUseCase,
  ReplaceUserOverridesUseCase,
  SetRolePermissionsUseCase,
  UpdateShopRoleUseCase,
} from '../../application/use-cases/rbac-management.use-cases';
import {
  CheckPermissionUseCase,
  GetMyPermissionsUseCase,
  GetPermissionsCatalogUseCase,
  GetRoleDetailUseCase,
  GetRolesCatalogUseCase,
} from '../../application/use-cases/rbac.use-cases';

@ApiTags('Rôles & Permissions')
@Controller('rbac')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class RbacController {
  constructor(
    private readonly getRolesCatalog: GetRolesCatalogUseCase,
    private readonly getPermissionsCatalog: GetPermissionsCatalogUseCase,
    private readonly getMyPermissions: GetMyPermissionsUseCase,
    private readonly checkPermission: CheckPermissionUseCase,
    private readonly getRoleDetail: GetRoleDetailUseCase,
    private readonly createShopRole: CreateShopRoleUseCase,
    private readonly updateShopRole: UpdateShopRoleUseCase,
    private readonly deleteShopRole: DeleteShopRoleUseCase,
    private readonly setRolePermissions: SetRolePermissionsUseCase,
    private readonly listUserOverrides: ListUserOverridesUseCase,
    private readonly createUserOverride: CreateUserOverrideUseCase,
    private readonly removeUserOverride: RemoveUserOverrideUseCase,
    private readonly replaceUserOverrides: ReplaceUserOverridesUseCase,
    private readonly getUserPermissions: GetUserEffectivePermissionsUseCase,
  ) {}

  @Get('roles')
  @RequirePermissions(Permission.RBAC_READ)
  @ApiOperation({
    summary: 'Catalogue des rôles (système + boutique)',
    description: [
      '**Permission** : `rbac:read`',
      '',
      'Liste les rôles système (`owner`, `seller`, `viewer`) et les rôles personnalisés de la boutique,',
      'avec leurs permissions directes et rôles parents (héritage).',
    ].join('\n'),
  })
  @ApiOkResponse({ type: RolesCatalogResponseDto })
  @ApiForbiddenResponse({ description: 'Permission `rbac:read` requise' })
  listRoles(@CurrentAuth() auth: AuthContext) {
    return this.getRolesCatalog.execute(auth.shopId);
  }

  @Get('roles/:code')
  @RequirePermissions(Permission.RBAC_READ)
  @ApiParam({ name: 'code', example: 'seller', description: 'Code du rôle (ex. seller, shop_1_caissier)' })
  @ApiOperation({
    summary: 'Détail d\'un rôle et ses permissions directes',
    description: '**Permission** : `rbac:read` — Retourne le rôle, ses parents et grants allow/deny.',
  })
  @ApiOkResponse({ type: RoleDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Rôle introuvable ou hors boutique' })
  getRole(@CurrentAuth() auth: AuthContext, @Param('code') code: string) {
    return this.getRoleDetail.execute(code, auth.shopId);
  }

  @Post('roles')
  @RequirePermissions(Permission.RBAC_MANAGE)
  @ApiOperation({
    summary: 'Créer un rôle personnalisé pour la boutique',
    description: [
      '**Permission** : `rbac:manage`',
      '',
      'Le code final sera `shop_{shopId}_{slug}` (ex. `shop_1_caissier`).',
      'Au moins une permission doit être définie. Héritage optionnel via `parentRoleCode`.',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: RoleCatalogItemDto })
  @ApiConflictResponse({ description: 'Code de rôle déjà utilisé' })
  @ApiBadRequestResponse({ description: 'Permissions invalides ou slug incorrect' })
  createRole(@CurrentAuth() auth: AuthContext, @Body() body: CreateShopRoleDto) {
    return this.createShopRole.execute(auth, body);
  }

  @Patch('roles/:code')
  @RequirePermissions(Permission.RBAC_MANAGE)
  @ApiParam({ name: 'code', example: 'shop_1_caissier' })
  @ApiOperation({
    summary: 'Mettre à jour un rôle boutique',
    description: '**Permission** : `rbac:manage` — Les rôles système sont protégés.',
  })
  @ApiOkResponse({ type: RoleCatalogItemDto })
  @ApiForbiddenResponse({ description: 'Rôle système protégé' })
  @ApiNotFoundResponse({ description: 'Rôle introuvable' })
  patchRole(
    @CurrentAuth() auth: AuthContext,
    @Param('code') code: string,
    @Body() body: UpdateShopRoleDto,
  ) {
    return this.updateShopRole.execute(auth, code, body);
  }

  @Delete('roles/:code')
  @RequirePermissions(Permission.RBAC_MANAGE)
  @ApiParam({ name: 'code', example: 'shop_1_caissier' })
  @ApiOperation({
    summary: 'Supprimer un rôle boutique',
    description: [
      '**Permission** : `rbac:manage`',
      '',
      'Refusé si le rôle est système ou encore assigné à des utilisateurs.',
    ].join('\n'),
  })
  @ApiOkResponse({ description: 'Rôle supprimé' })
  @ApiForbiddenResponse({ description: 'Rôle système ou encore utilisé' })
  removeRole(@CurrentAuth() auth: AuthContext, @Param('code') code: string) {
    return this.deleteShopRole.execute(auth, code);
  }

  @Put('roles/:code/permissions')
  @RequirePermissions(Permission.RBAC_MANAGE)
  @ApiParam({ name: 'code', example: 'shop_1_caissier' })
  @ApiOperation({
    summary: 'Remplacer les permissions d\'un rôle',
    description: '**Permission** : `rbac:manage` — Remplace intégralement la liste des grants allow/deny.',
  })
  @ApiOkResponse({ type: RoleCatalogItemDto })
  replaceRolePermissions(
    @CurrentAuth() auth: AuthContext,
    @Param('code') code: string,
    @Body() body: SetRolePermissionsDto,
  ) {
    return this.setRolePermissions.execute(auth, code, body);
  }

  @Get('permissions')
  @RequirePermissions(Permission.RBAC_READ)
  @ApiOperation({
    summary: 'Catalogue modules et permissions',
    description: [
      '**Permission** : `rbac:read`',
      '',
      'Référentiel complet des modules (`inventory`, `sales`, …) et permissions granulaires.',
      'Utilisé pour construire les écrans de gestion des rôles.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: PermissionsCatalogResponseDto })
  listPermissions() {
    return this.getPermissionsCatalog.execute();
  }

  @Get('me')
  @ApiOperation({
    summary: 'Permissions effectives de l\'utilisateur connecté',
    description: [
      'Aucune permission spécifique requise — session valide suffit.',
      '',
      'Retourne le rôle, le libellé et la liste résolue des permissions (rôle + héritage + overrides).',
    ].join('\n'),
  })
  @ApiOkResponse({ type: MyPermissionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Session invalide' })
  myPermissions(@CurrentAuth() auth: AuthContext) {
    return this.getMyPermissions.execute(auth);
  }

  @Get('check/:permission')
  @ApiParam({
    name: 'permission',
    example: 'inventory:write',
    description: 'Code permission à vérifier',
  })
  @ApiOperation({
    summary: 'Vérifier une permission',
    description: 'Utile côté client pour afficher/masquer des actions UI sans parser toute la liste.',
  })
  @ApiOkResponse({ type: CheckPermissionResponseDto })
  check(@CurrentAuth() auth: AuthContext, @Param('permission') permission: Permission) {
    return this.checkPermission.execute(auth, permission);
  }

  @Get('users/:userId/overrides')
  @RequirePermissions(Permission.RBAC_OVERRIDE)
  @ApiParam({ name: 'userId', example: 2 })
  @ApiOperation({
    summary: 'Lister les overrides d\'un utilisateur',
    description: '**Permission** : `rbac:override` — Permissions individuelles grant/deny hors rôle.',
  })
  @ApiOkResponse({ type: UserOverridesResponseDto })
  userOverrides(@CurrentAuth() auth: AuthContext, @Param('userId', ParseIntPipe) userId: number) {
    return this.listUserOverrides.execute(auth, userId);
  }

  @Get('users/:userId/permissions')
  @RequirePermissions(Permission.RBAC_READ)
  @ApiParam({ name: 'userId', example: 2 })
  @ApiOperation({
    summary: 'Permissions effectives d\'un utilisateur',
    description: [
      '**Permission** : `rbac:read`',
      '',
      'Résolution complète rôle + héritage + overrides pour un membre de l\'équipe.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: UserEffectivePermissionsResponseDto })
  userPermissions(@CurrentAuth() auth: AuthContext, @Param('userId', ParseIntPipe) userId: number) {
    return this.getUserPermissions.execute(auth, userId);
  }

  @Put('users/:userId/permissions')
  @RequirePermissions(Permission.RBAC_OVERRIDE)
  @ApiParam({ name: 'userId', example: 2 })
  @ApiOperation({
    summary: 'Remplacer les permissions individuelles d\'un utilisateur',
    description: [
      '**Permission** : `rbac:override`',
      '',
      'Remplace intégralement la liste des overrides (grant/deny) de l\'utilisateur.',
      'Une liste vide supprime tous les overrides.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: UserPermissionOverridesReplaceResponseDto })
  replaceUserPermissions(
    @CurrentAuth() auth: AuthContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: ReplaceUserPermissionOverridesDto,
  ) {
    return this.replaceUserOverrides.execute(auth, userId, body);
  }

  @Post('users/:userId/overrides')
  @RequirePermissions(Permission.RBAC_OVERRIDE)
  @ApiParam({ name: 'userId', example: 2 })
  @ApiOperation({
    summary: 'Accorder ou révoquer une permission individuelle',
    description: [
      '**Permission** : `rbac:override`',
      '',
      '`effect: grant` ajoute une permission ; `deny` la retire même si le rôle l\'accorde.',
      'Expiration optionnelle via `expiresAt` (epoch ms).',
    ].join('\n'),
  })
  @ApiCreatedResponse({ description: 'Override créé ou mis à jour' })
  addOverride(
    @CurrentAuth() auth: AuthContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: CreatePermissionOverrideDto,
  ) {
    return this.createUserOverride.execute(auth, userId, body);
  }

  @Delete('users/:userId/overrides/:permissionCode')
  @RequirePermissions(Permission.RBAC_OVERRIDE)
  @ApiParam({ name: 'userId', example: 2 })
  @ApiParam({ name: 'permissionCode', example: 'sales:cancel' })
  @ApiOperation({
    summary: 'Supprimer un override utilisateur',
    description: '**Permission** : `rbac:override`',
  })
  @ApiOkResponse({ description: 'Override supprimé' })
  @ApiNotFoundResponse({ description: 'Override introuvable' })
  deleteOverride(
    @CurrentAuth() auth: AuthContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Param('permissionCode') permissionCode: string,
  ) {
    return this.removeUserOverride.execute(auth, userId, permissionCode);
  }
}
