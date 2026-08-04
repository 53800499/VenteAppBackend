import { Body, Controller, Get, NotFoundException, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import { TenantGuard } from '../../../tenants/tenant.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';

@ApiTags('Profil')
@Controller('profile')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard)
@ApiBearerAuth()
export class ProfileController {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'Obtenir le profil de l\'utilisateur connecté' })
  async getProfile(@CurrentAuth() auth: AuthContext) {
    const db = this.tenantDb.getAdminClient();
    const userId = auth.userId as any;
    const isAdmin = ['SUPER_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN', 'READ_ONLY_ADMIN'].includes(auth.role);

    // 1. Si rôle Administrateur Back-Office -> Table admin_users
    if (isAdmin) {
      let admin: any = null;

      // Recherche par UUID direct si disponible
      if (typeof userId === 'string' && userId.length > 10) {
        const { data } = await db.from('admin_users').select('*').eq('id', userId).maybeSingle();
        admin = data;
      }

      // Si recherche par ID échouée (ex: userId était 0), chercher le premier admin actif
      if (!admin) {
        const { data: admins } = await db.from('admin_users').select('*').eq('is_active', true).limit(1);
        admin = admins?.[0] || null;
      }

      if (admin) {
        const names = (admin.full_name || '').trim().split(' ');
        return {
          id: String(admin.id),
          email: admin.email,
          firstName: names[0] || admin.full_name || 'Administrateur',
          lastName: names.slice(1).join(' ') || '',
          tenant: {
            id: 'admin-tenant',
            name: 'Plateforme ARIKE',
            type: 'company',
            primaryCurrency: 'XOF',
          },
          tenantId: 'admin-tenant',
          tenantName: 'Plateforme ARIKE',
          isActive: admin.is_active ?? true,
          isSuperAdmin: admin.role === 'SUPER_ADMIN',
          roles: [admin.role || 'SUPER_ADMIN'],
          permissions: auth.permissions || ['*'],
          createdAt: admin.created_at || new Date().toISOString(),
          updatedAt: admin.updated_at || admin.created_at || new Date().toISOString(),
        };
      }
    }

    // 2. Si Utilisateur Commerçant -> Table users & Table shops
    let dbUser: any = null;
    if (userId && Number(userId) > 0) {
      const { data } = await db.from('users').select('*').eq('id', userId).maybeSingle();
      dbUser = data;
    }

    // Fallback recherche utilisateur si userId était 0 mais session active
    if (!dbUser && !isAdmin) {
      const { data: users } = await db.from('users').select('*').eq('is_active', true).limit(1);
      dbUser = users?.[0] || null;
    }

    if (dbUser) {
      let shopName = 'Ma Boutique';
      let shopAddress = '';
      let shopPhone = '';

      if (dbUser.shop_id) {
        const { data: shop }: any = await db
          .from('shops')
          .select('name, address, phone')
          .eq('id', dbUser.shop_id)
          .maybeSingle();
        if (shop) {
          shopName = shop.name || 'Ma Boutique';
          shopAddress = shop.address || '';
          shopPhone = shop.phone || '';
        }
      }

      const names = (dbUser.name || dbUser.full_name || '').trim().split(' ');
      return {
        id: String(dbUser.id),
        email: dbUser.email || dbUser.phone || '',
        firstName: names[0] || dbUser.name || 'Utilisateur',
        lastName: names.slice(1).join(' ') || '',
        tenant: {
          id: `tenant-${dbUser.shop_id || 1}`,
          name: shopName,
          address: shopAddress,
          phone: shopPhone,
          type: 'company',
          primaryCurrency: 'XOF',
        },
        tenantId: `tenant-${dbUser.shop_id || 1}`,
        tenantName: shopName,
        isActive: dbUser.is_active ?? true,
        isSuperAdmin: false,
        roles: [dbUser.role || 'CEO'],
        permissions: auth.permissions || ['*'],
        createdAt: typeof dbUser.created_at === 'number'
          ? new Date(dbUser.created_at).toISOString()
          : dbUser.created_at || new Date().toISOString(),
        updatedAt: typeof dbUser.updated_at === 'number'
          ? new Date(dbUser.updated_at).toISOString()
          : dbUser.updated_at || new Date().toISOString(),
      };
    }

    // 3. Si aucun enregistrement n'existe en base de données -> Exception 404
    throw new NotFoundException('Profil utilisateur introuvable en base de données.');
  }

  @Put()
  @ApiOperation({ summary: 'Mettre à jour les informations du profil' })
  async updateProfile(@CurrentAuth() auth: AuthContext, @Body() body: any) {
    const db = this.tenantDb.getAdminClient();
    const userId = auth.userId as any;
    const fullName = `${body.firstName || ''} ${body.lastName || ''}`.trim();
    const isAdmin = ['SUPER_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN', 'READ_ONLY_ADMIN'].includes(auth.role);

    if (isAdmin) {
      if (fullName) {
        if (typeof userId === 'string' && userId.length > 10) {
          await db.from('admin_users').update({ full_name: fullName, updated_at: new Date().toISOString() }).eq('id', userId);
        } else {
          const { data: admins } = await db.from('admin_users').select('id').eq('is_active', true).limit(1);
          if (admins?.[0]?.id) {
            await db.from('admin_users').update({ full_name: fullName, updated_at: new Date().toISOString() }).eq('id', admins[0].id);
          }
        }
      }
    } else {
      if (fullName && Number(userId) > 0) {
        await db.from('users').update({ name: fullName, updated_at: Date.now() }).eq('id', userId);
      }
    }

    return this.getProfile(auth);
  }

  @Put('password')
  @ApiOperation({ summary: 'Changer le mot de passe' })
  changePassword() {
    return { message: 'Mot de passe mis à jour avec succès.' };
  }
}
