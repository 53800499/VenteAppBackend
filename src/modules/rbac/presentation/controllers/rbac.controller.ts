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
  ApiForbiddenResponse,
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
  SetRolePermissionsDto,
  UpdateShopRoleDto,
} from '../../application/dto/rbac-management.dto';
import {
  MyPermissionsResponseDto,
  PermissionsCatalogResponseDto,
  RolesCatalogResponseDto,
} from '../../application/dto/rbac-response.dto';
import {
  CreateShopRoleUseCase,
  CreateUserOverrideUseCase,
  DeleteShopRoleUseCase,
  ListUserOverridesUseCase,
  RemoveUserOverrideUseCase,
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
  ) {}

  @Get('roles')
  @RequirePermissions(Permission.RBAC_READ)
  @ApiSecurity('session-token')
  @ApiOperation({ summary: 'Catalogue des rôles (système + boutique)' })
  @ApiOkResponse({ type: RolesCatalogResponseDto })
  listRoles(@CurrentAuth() auth: AuthContext) {
    return this.getRolesCatalog.execute(auth.shopId);
  }

  @Get('roles/:code')
  @RequirePermissions(Permission.RBAC_READ)
  @ApiParam({ name: 'code', example: 'seller' })
  @ApiOperation({ summary: 'Détail d\'un rôle et ses permissions directes' })
  getRole(@CurrentAuth() auth: AuthContext, @Param('code') code: string) {
    return this.getRoleDetail.execute(code, auth.shopId);
  }

  @Post('roles')
  @RequirePermissions(Permission.RBAC_MANAGE)
  @ApiOperation({ summary: 'Créer un rôle personnalisé pour la boutique' })
  createRole(@CurrentAuth() auth: AuthContext, @Body() body: CreateShopRoleDto) {
    return this.createShopRole.execute(auth, body);
  }

  @Patch('roles/:code')
  @RequirePermissions(Permission.RBAC_MANAGE)
  @ApiParam({ name: 'code', example: 'shop_1_caissier' })
  @ApiOperation({ summary: 'Mettre à jour un rôle boutique' })
  patchRole(
    @CurrentAuth() auth: AuthContext,
    @Param('code') code: string,
    @Body() body: UpdateShopRoleDto,
  ) {
    return this.updateShopRole.execute(auth, code, body);
  }

  @Delete('roles/:code')
  @RequirePermissions(Permission.RBAC_MANAGE)
  @ApiOperation({ summary: 'Supprimer un rôle boutique' })
  removeRole(@CurrentAuth() auth: AuthContext, @Param('code') code: string) {
    return this.deleteShopRole.execute(auth, code);
  }

  @Put('roles/:code/permissions')
  @RequirePermissions(Permission.RBAC_MANAGE)
  @ApiOperation({ summary: 'Remplacer les permissions d\'un rôle' })
  replaceRolePermissions(
    @CurrentAuth() auth: AuthContext,
    @Param('code') code: string,
    @Body() body: SetRolePermissionsDto,
  ) {
    return this.setRolePermissions.execute(auth, code, body);
  }

  @Get('permissions')
  @RequirePermissions(Permission.RBAC_READ)
  @ApiSecurity('session-token')
  @ApiOperation({ summary: 'Catalogue modules et permissions' })
  @ApiOkResponse({ type: PermissionsCatalogResponseDto })
  listPermissions() {
    return this.getPermissionsCatalog.execute();
  }

  @Get('me')
  @ApiSecurity('session-token')
  @ApiOperation({ summary: 'Permissions effectives de l\'utilisateur connecté' })
  @ApiOkResponse({ type: MyPermissionsResponseDto })
  myPermissions(@CurrentAuth() auth: AuthContext) {
    return this.getMyPermissions.execute(auth);
  }

  @Get('check/:permission')
  @ApiSecurity('session-token')
  @ApiParam({ name: 'permission', example: 'sales:cancel' })
  @ApiOperation({ summary: 'Vérifier une permission' })
  check(@CurrentAuth() auth: AuthContext, @Param('permission') permission: Permission) {
    return this.checkPermission.execute(auth, permission);
  }

  @Get('users/:userId/overrides')
  @RequirePermissions(Permission.RBAC_OVERRIDE)
  @ApiParam({ name: 'userId', example: 2 })
  @ApiOperation({ summary: 'Lister les overrides d\'un utilisateur' })
  userOverrides(@CurrentAuth() auth: AuthContext, @Param('userId', ParseIntPipe) userId: number) {
    return this.listUserOverrides.execute(auth, userId);
  }

  @Post('users/:userId/overrides')
  @RequirePermissions(Permission.RBAC_OVERRIDE)
  @ApiOperation({ summary: 'Accorder ou révoquer une permission individuelle' })
  addOverride(
    @CurrentAuth() auth: AuthContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: CreatePermissionOverrideDto,
  ) {
    return this.createUserOverride.execute(auth, userId, body);
  }

  @Delete('users/:userId/overrides/:permissionCode')
  @RequirePermissions(Permission.RBAC_OVERRIDE)
  @ApiOperation({ summary: 'Supprimer un override utilisateur' })
  deleteOverride(
    @CurrentAuth() auth: AuthContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Param('permissionCode') permissionCode: string,
  ) {
    return this.removeUserOverride.execute(auth, userId, permissionCode);
  }
}
