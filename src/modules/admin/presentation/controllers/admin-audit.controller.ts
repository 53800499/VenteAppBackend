import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../../shared/guards/admin.guard';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';

@ApiTags('Admin - Journal d\'Audit Plateforme')
@Controller('admin/audit')
@UseGuards(AdminGuard)
@ApiBearerAuth()
@UseInterceptors(TransformResponseInterceptor)
export class AdminAuditController {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'Journal d\'audit inaltérable des actions administrateurs' })
  async getAdminAuditLog(
    @Query('tenantId') tenantId?: string,
    @Query('action') actionFilter?: string,
  ) {
    const db = this.tenantDb.getAdminClient();

    try {
      let query = db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      if (actionFilter) {
        query = query.eq('action', actionFilter);
      }

      const { data: logs } = await query;
      const { data: orgs } = await db.from('organizations').select('id, name');
      const orgMap = new Map((orgs || []).map((o: any) => [String(o.id), o.name]));

      return (logs || []).map((l: any) => ({
        id: `audit-${l.id}`,
        adminEmail: l.admin_email || l.user_email || 'admin@arike.app',
        action: l.action || 'ADMIN_ACTION',
        tenantId: l.tenant_id ? `tenant-${l.tenant_id}` : 'plateforme',
        tenantName: orgMap.get(String(l.tenant_id)) || (l.tenant_id ? `Entreprise #${l.tenant_id}` : 'Plateforme ARIKE'),
        details: l.details || {},
        timestamp: typeof l.created_at === 'number'
          ? new Date(l.created_at).toISOString()
          : l.created_at || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }
}
