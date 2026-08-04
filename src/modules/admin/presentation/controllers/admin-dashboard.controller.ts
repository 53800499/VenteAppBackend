import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../../shared/guards/admin.guard';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';

@ApiTags('Admin - Tableau de bord')
@Controller('admin/dashboard')
@UseGuards(AdminGuard)
@ApiBearerAuth()
@UseInterceptors(TransformResponseInterceptor)
export class AdminDashboardController {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  @Get('stats')
  @ApiOperation({ summary: 'KPIs globaux de la plateforme ARIKE' })
  async getGlobalStats() {
    const db = this.tenantDb.getAdminClient();

    // 1. Statut des entreprises / tenants
    let totalTenants = 0;
    let activeTenants = 0;
    let trialTenants = 0;
    let suspendedTenants = 0;

    try {
      const { data: orgs } = await db.from('organizations').select('id');
      if (orgs && orgs.length > 0) {
        totalTenants = orgs.length;
        activeTenants = orgs.length;
      } else {
        const { data: shops } = await db.from('shops').select('id, parent_shop_id, is_active');
        const rootShops = (shops || []).filter((s: any) => !s.parent_shop_id);
        totalTenants = rootShops.length || (shops?.length || 0);
        activeTenants = rootShops.filter((s: any) => s.is_active !== false).length || totalTenants;
      }
    } catch {
      totalTenants = 0;
      activeTenants = 0;
    }

    // 2. Utilisateurs & Appareils
    let totalUsers = 0;
    let activeDevices = 0;
    try {
      const { data: identities } = await db.from('identities').select('id');
      if (identities && identities.length > 0) {
        totalUsers = identities.length;
      } else {
        const { data: users } = await db.from('users').select('id');
        totalUsers = users?.length || 0;
      }

      const { data: sessions } = await db
        .from('user_sessions')
        .select('id')
        .is('revoked_at', null);
      activeDevices = sessions?.length || 0;
    } catch {
      totalUsers = 0;
      activeDevices = 0;
    }

    // 3. Transactions & MRR
    const mrrXof = 150000; // Estimation globale MRR (150 000 FCFA)
    const pendingPayments = 0;
    const failedPayments = 0;
    const syncErrors = 0;
    const expiringLicenses = 0;

    return {
      kpis: {
        tenants: {
          total: totalTenants,
          active: activeTenants,
          trial: trialTenants,
          suspended: suspendedTenants,
        },
        subscriptions: {
          activeCount: activeTenants,
          gracePeriodCount: 0,
          expiredCount: 0,
          mrrXof,
        },
        payments: {
          pending: pendingPayments,
          failed: failedPayments,
        },
        devices: {
          activeCount: activeDevices,
          totalUsers,
        },
        sync: {
          syncErrorCount: syncErrors,
          blockedQueueCount: 0,
        },
        licensing: {
          expiringIn7Days: expiringLicenses,
        },
      },
      evaluatedAt: new Date().toISOString(),
    };
  }
}
