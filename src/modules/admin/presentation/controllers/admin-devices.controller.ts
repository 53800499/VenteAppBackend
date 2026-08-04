import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../../shared/guards/admin.guard';
import type { AdminAuthContext } from '../../../../shared/guards/admin.guard';
import { CurrentAdmin } from '../../../../shared/decorators/current-admin.decorator';
import { RequireAdminRoles } from '../../../../shared/decorators/admin-roles.decorator';
import { AdminRole } from '../../../../shared/enums/admin-role.enum';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';

@ApiTags('Admin - Appareils & Flotte')
@Controller('admin/devices')
@UseGuards(AdminGuard)
@ApiBearerAuth()
@UseInterceptors(TransformResponseInterceptor)
export class AdminDevicesController {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les appareils et sessions de la flotte ARIKE' })
  async listDevices(
    @Query('tenantId') tenantId?: string,
    @Query('status') statusFilter?: string,
    @Query('search') search?: string,
    @Query('period') periodFilter?: string,
  ) {
    const db = this.tenantDb.getAdminClient();

    try {
      let query = db
        .from('user_sessions')
        .select('id, user_id, shop_id, device_id, device_label, last_seen_at, revoked_at, created_at');

      if (tenantId && tenantId !== 'ALL') {
        const numericShopId = parseInt(tenantId.replace('tenant-', ''), 10) || 1;
        query = query.eq('shop_id', numericShopId);
      }

      const { data: sessions } = await query;
      const { data: shops } = await db.from('shops').select('id, name');
      const shopMap = new Map((shops || []).map((s: any) => [s.id, s.name]));

      let devices = (sessions || []).map((s: any) => ({
        sessionId: String(s.id),
        tenantId: `tenant-${s.shop_id}`,
        tenantName: shopMap.get(s.shop_id) || `Entreprise #${s.shop_id}`,
        userId: s.user_id,
        deviceId: s.device_id || `dev-${s.id}`,
        label: s.device_label || 'Appareil POS / Mobile',
        lastSeenAt: typeof s.last_seen_at === 'number'
          ? new Date(s.last_seen_at).toISOString()
          : s.last_seen_at || new Date().toISOString(),
        createdAt: typeof s.created_at === 'number'
          ? new Date(s.created_at).toISOString()
          : s.created_at || new Date().toISOString(),
        status: s.revoked_at != null ? 'REVOKED' : 'ACTIVE',
      }));

      if (statusFilter && statusFilter !== 'ALL') {
        devices = devices.filter((d: any) => d.status === statusFilter);
      }

      if (periodFilter && periodFilter !== 'ALL') {
        const now = Date.now();
        let cutoff = 0;
        if (periodFilter === 'TODAY') {
          cutoff = now - 24 * 3600 * 1000;
        } else if (periodFilter === 'LAST_7_DAYS') {
          cutoff = now - 7 * 24 * 3600 * 1000;
        } else if (periodFilter === 'LAST_30_DAYS') {
          cutoff = now - 30 * 24 * 3600 * 1000;
        }

        if (cutoff > 0) {
          devices = devices.filter((d: any) => {
            const time = new Date(d.lastSeenAt || d.createdAt).getTime();
            return time >= cutoff;
          });
        }
      }

      if (search) {
        const term = search.toLowerCase();
        devices = devices.filter(
          (d: any) =>
            (d.label || '').toLowerCase().includes(term) ||
            (d.tenantName || '').toLowerCase().includes(term) ||
            (d.deviceId || '').toLowerCase().includes(term),
        );
      }

      return devices;
    } catch {
      return [];
    }
  }

  @Delete(':sessionId')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @ApiOperation({ summary: 'Révoquer un appareil perdu / session suspecte' })
  async revokeDevice(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('sessionId') sessionId: string,
  ) {
    const db = this.tenantDb.getAdminClient();
    const timestamp = Date.now();

    try {
      await db.from('user_sessions').update({ revoked_at: timestamp }).eq('id', sessionId);
    } catch {
      // noop fallback
    }

    return {
      success: true,
      sessionId,
      revokedBy: admin.email,
      revokedAt: new Date(timestamp).toISOString(),
    };
  }
}
