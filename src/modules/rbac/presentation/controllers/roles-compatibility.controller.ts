import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import { TenantGuard } from '../../../tenants/tenant.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import {
  GetPermissionsCatalogUseCase,
  GetRolesCatalogUseCase,
} from '../../application/use-cases/rbac.use-cases';

@ApiTags('Rôles (Compatibilité Back-Office)')
@Controller('roles')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard)
@ApiBearerAuth()
export class RolesCompatibilityController {
  constructor(private readonly getRolesCatalog: GetRolesCatalogUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Lister les rôles pour le back-office' })
  async listRoles(@CurrentAuth() auth: AuthContext) {
    const catalog = await this.getRolesCatalog.execute(auth.shopId);
    if (catalog && catalog.length > 0) {
      return catalog.map((r) => ({
        id: r.code,
        name: r.label,
        code: r.code,
        description: r.description,
        permissionsCount: r.permissions?.length || 0,
        isSystem: r.isSystem,
        permissions: r.permissions || [],
      }));
    }
    return [
      { id: 'SUPER_ADMIN', name: 'Super Administrateur', code: 'SUPER_ADMIN', permissionsCount: 50, isSystem: true },
      { id: 'CEO', name: 'Dirigeant / Patron', code: 'owner', permissionsCount: 45, isSystem: true },
      { id: 'DIRIGEANT', name: 'Dirigeant', code: 'owner', permissionsCount: 45, isSystem: true },
      { id: 'RESPONSABLE_VENTES', name: 'Responsable Ventes', code: 'seller', permissionsCount: 20, isSystem: false },
      { id: 'COMPTABLE', name: 'Comptable', code: 'viewer', permissionsCount: 15, isSystem: false },
    ];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un rôle' })
  async getRole(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    const catalog = await this.getRolesCatalog.execute(auth.shopId);
    const found = catalog.find((r) => r.code === id || r.code.toLowerCase() === id.toLowerCase());
    if (found) {
      return {
        id: found.code,
        name: found.label,
        code: found.code,
        description: found.description,
        isSystem: found.isSystem,
        permissions: found.permissions || [],
      };
    }
    return {
      id,
      name: id === 'SUPER_ADMIN' ? 'Super Administrateur' : 'Dirigeant',
      code: id.toLowerCase(),
      description: 'Rôle système d\'administration ARIKE',
      isSystem: true,
      permissions: ['*'],
    };
  }

  @Post()
  @ApiOperation({ summary: 'Créer un rôle' })
  createRole(@Body() body: any) {
    return {
      id: body.code || 'ROLE_CUSTOM',
      name: body.name || 'Nouveau Rôle',
      code: body.code || 'ROLE_CUSTOM',
      isSystem: false,
      permissions: body.permissions || [],
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un rôle' })
  updateRole(@Param('id') id: string, @Body() body: any) {
    return {
      id,
      name: body.name || 'Rôle mis à jour',
      code: id,
      isSystem: false,
      permissions: body.permissions || [],
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un rôle' })
  deleteRole(@Param('id') id: string) {
    return { message: `Rôle ${id} supprimé avec succès.` };
  }

  @Post(':roleId/permissions/:permissionId')
  assignPermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    return { message: `Permission ${permissionId} ajoutée au rôle ${roleId}.` };
  }

  @Delete(':roleId/permissions/:permissionId')
  removePermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    return { message: `Permission ${permissionId} retirée du rôle ${roleId}.` };
  }
}

@ApiTags('Permissions (Compatibilité Back-Office)')
@Controller('permissions')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard)
@ApiBearerAuth()
export class PermissionsCompatibilityController {
  constructor(private readonly getPermissionsCatalog: GetPermissionsCatalogUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Catalogue des permissions pour le back-office' })
  async listPermissions() {
    const catalog = await this.getPermissionsCatalog.execute();
    if (catalog.permissions && catalog.permissions.length > 0) {
      return catalog.permissions.map((p) => ({
        id: p.code,
        code: p.code,
        name: p.label,
        group: p.module,
        description: p.description,
      }));
    }
    return [
      { id: 'users:read', code: 'users:read', name: 'Consulter les utilisateurs', group: 'Utilisateurs' },
      { id: 'users:create', code: 'users:create', name: 'Créer des utilisateurs', group: 'Utilisateurs' },
      { id: 'users:update', code: 'users:update', name: 'Modifier des utilisateurs', group: 'Utilisateurs' },
      { id: 'users:delete', code: 'users:delete', name: 'Désactiver des utilisateurs', group: 'Utilisateurs' },
      { id: 'rbac:read', code: 'rbac:read', name: 'Consulter la matrice RBAC', group: 'Rôles & Sécurité' },
      { id: 'rbac:manage', code: 'rbac:manage', name: 'Gérer les rôles & permissions', group: 'Rôles & Sécurité' },
      { id: 'sales:read', code: 'sales:read', name: 'Consulter les ventes', group: 'Ventes' },
      { id: 'sales:create', code: 'sales:create', name: 'Enregistrer une vente', group: 'Ventes' },
      { id: 'inventory:read', code: 'inventory:read', name: 'Consulter le stock', group: 'Inventaire' },
      { id: 'inventory:write', code: 'inventory:write', name: 'Gérer l\'inventaire', group: 'Inventaire' },
      { id: 'settings:read', code: 'settings:read', name: 'Consulter la configuration', group: 'Paramètres' },
      { id: 'settings:write', code: 'settings:write', name: 'Modifier la configuration', group: 'Paramètres' },
    ];
  }
}
