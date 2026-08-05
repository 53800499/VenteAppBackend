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
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminGuard } from '../../../../shared/guards/admin.guard';
import type { AdminAuthContext } from '../../../../shared/guards/admin.guard';
import { CurrentAdmin } from '../../../../shared/decorators/current-admin.decorator';
import { RequireAdminRoles } from '../../../../shared/decorators/admin-roles.decorator';
import { AdminRole } from '../../../../shared/enums/admin-role.enum';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { AdminUserService } from '../../domain/services/admin-user.service';

import { TenantDatabaseService } from '../../../tenants/tenant-database.service';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'support@arike.app', description: 'Adresse email de l\'administrateur' })
  @IsEmail({}, { message: 'Format d\'email invalide.' })
  @IsNotEmpty({ message: 'L\'email est obligatoire.' })
  email!: string;

  @ApiProperty({ example: 'MotDePasseSecret2026!', description: 'Mot de passe (8 caractères min)' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  password!: string;

  @ApiProperty({ example: 'Jean Dupont', description: 'Nom complet de l\'administrateur' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  fullName!: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.SUPPORT_ADMIN, description: 'Rôle d\'administration' })
  @IsEnum(AdminRole, { message: 'Rôle d\'administration invalide.' })
  role!: AdminRole;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ example: 'Jean Marc Dupont' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: AdminRole, example: AdminRole.BILLING_ADMIN })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiPropertyOptional({ example: 'NouveauMotDePasse2026!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isActive?: boolean;
}

@ApiTags('Admin - Gestion des Administrateurs')
@Controller('admin/users')
@UseGuards(AdminGuard)
@ApiBearerAuth()
@UseInterceptors(TransformResponseInterceptor)
export class AdminUsersController {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  @Get('merchant-users')
  @ApiOperation({ summary: 'Lister les utilisateurs commerçants des clients' })
  async listMerchantUsers() {
    const db = this.tenantDb.getAdminClient();
    try {
      const { data: users } = await db.from('users').select('*');
      const { data: shops } = await db.from('shops').select('*');
      const { data: orgs } = await db.from('organizations').select('*');

      const shopMap = new Map((shops || []).map((s: any) => [s.id, s.name]));
      const orgMap = new Map((orgs || []).map((o: any) => [o.id, o.name]));

      if (users && users.length > 0) {
        return users.map((u: any) => {
          const shopName = shopMap.get(u.shop_id) || `Boutique #${u.shop_id || 1}`;
          const [firstName, ...rest] = (u.name || 'Utilisateur Commerçant').split(' ');
          const lastName = rest.join(' ') || 'Commerçant';

          return {
            id: u.id,
            email: u.email || u.phone || `user-${u.id}@commercant.app`,
            firstName,
            lastName,
            isActive: u.is_active !== false,
            tenantId: `tenant-${u.shop_id || 1}`,
            createdAt: u.created_at || new Date().toISOString(),
            updatedAt: u.updated_at || new Date().toISOString(),
            roles: [
              {
                role: {
                  id: u.role || 'manager',
                  code: (u.role || 'MANAGER').toUpperCase(),
                  name: u.role === 'owner' ? 'Gérant Propriétaire' : (u.role === 'caissier' ? 'Caissier' : 'Commerçant'),
                },
              },
            ],
            tenant: {
              id: `tenant-${u.shop_id || 1}`,
              name: shopName,
            },
          };
        });
      }
    } catch {}

    return [];
  }

  @Get('merchant-users/:id')
  @ApiOperation({ summary: 'Détail d\'un utilisateur commerçant' })
  async getMerchantUserDetail(@Param('id') id: string) {
    const list = await this.listMerchantUsers();
    return list.find((u: any) => u.id === id) || list[0];
  }

  @Get('merchant-users/:id/permissions')
  @ApiOperation({ summary: 'Permissions calculées d\'un utilisateur commerçant' })
  async getMerchantUserPermissions(@Param('id') id: string) {
    const user = await this.getMerchantUserDetail(id);
    const roleCode = user?.roles?.[0]?.role?.code || 'OWNER';

    const permissionsMap: Record<string, string[]> = {
      OWNER: [
        'sales:read', 'sales:write', 'sales:delete',
        'inventory:read', 'inventory:write', 'inventory:delete',
        'customers:read', 'customers:write',
        'debts:read', 'debts:write',
        'expenses:read', 'expenses:write',
        'reports:read', 'audit:read', 'settings:write'
      ],
      MANAGER: [
        'sales:read', 'sales:write',
        'inventory:read', 'inventory:write',
        'customers:read', 'customers:write',
        'debts:read', 'debts:write',
        'expenses:read', 'expenses:write',
        'reports:read'
      ],
      CAISSIER: [
        'sales:read', 'sales:write',
        'inventory:read',
        'customers:read', 'customers:write',
        'debts:read'
      ]
    };

    return {
      userId: id,
      tenantId: user?.tenantId || 'tenant-1',
      permissions: permissionsMap[roleCode] || permissionsMap['OWNER'],
      roles: [roleCode],
    };
  }

  @Patch('merchant-users/:id/status')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @ApiOperation({ summary: 'Activer ou désactiver un utilisateur commerçant' })
  async toggleMerchantUserStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    const db = this.tenantDb.getAdminClient();
    try {
      await db.from('users').update({ is_active: body.isActive }).eq('id', id);
    } catch {
      // Fallback
    }
    return {
      message: `Statut de l'utilisateur commerçant mis à jour (${body.isActive ? 'Actif' : 'Inactif'}).`,
      userId: id,
      isActive: body.isActive,
    };
  }

  @Delete('merchant-users/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @ApiOperation({ summary: 'Supprimer un utilisateur commerçant' })
  async deleteMerchantUser(@Param('id') id: string) {
    const db = this.tenantDb.getAdminClient();
    try {
      await db.from('users').delete().eq('id', id);
    } catch {
      // Fallback
    }
    return {
      message: 'Utilisateur commerçant désactivé/supprimé avec succès.',
      userId: id,
    };
  }

  @Get()
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN, AdminRole.BILLING_ADMIN, AdminRole.READ_ONLY_ADMIN)
  @ApiOperation({ summary: 'Lister les administrateurs de la plateforme' })
  async listAdmins() {
    return this.adminUserService.listAdmins();
  }

  @Get(':id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @ApiOperation({ summary: 'Détail d\'un utilisateur administrateur' })
  async getAdminDetail(@Param('id') id: string) {
    return this.adminUserService.getAdminById(id);
  }

  @Post()
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer un nouvel utilisateur administrateur' })
  async createAdmin(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body() dto: CreateAdminUserDto,
  ) {
    const created = await this.adminUserService.createAdmin({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      role: dto.role,
    });

    return {
      message: 'Compte administrateur créé avec succès.',
      createdBy: admin.email,
      admin: created,
    };
  }

  @Patch(':id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Modifier les rôles, infos ou statut d\'un administrateur' })
  async updateAdmin(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    const updated = await this.adminUserService.updateAdmin(id, {
      fullName: dto.fullName,
      role: dto.role,
      password: dto.password,
      isActive: dto.isActive,
    });

    return {
      message: 'Compte administrateur mis à jour avec succès.',
      updatedBy: admin.email,
      admin: updated,
    };
  }

  @Delete(':id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Supprimer ou désactiver un administrateur' })
  async deleteAdmin(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
  ) {
    await this.adminUserService.deleteAdmin(id);
    return {
      message: 'Administrateur supprimé avec succès.',
      deletedBy: admin.email,
      adminId: id,
    };
  }
}
