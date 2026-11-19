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

      // ─────────────────────────────────────────────────────────────
      // DÉDUPLICATION PAR APPAREIL PHYSIQUE (1 appareil = 1 entrée)
      // Évite de surcharger la liste avec les sessions multiples du même appareil
      // ─────────────────────────────────────────────────────────────
      const groupedDevices = new Map<string, {
        sessions: any[];
        latestSession: any;
        firstConnectedMs: number;
        lastSeenMs: number;
      }>();

      for (const s of (sessions || [])) {
        const deviceId = s.device_id || `dev-${s.id}`;
        const key = `${s.shop_id}::${deviceId}`;

        const createdMs = typeof s.created_at === 'number'
          ? s.created_at
          : new Date(s.created_at || 0).getTime();
        const lastSeenMs = typeof s.last_seen_at === 'number'
          ? s.last_seen_at
          : new Date(s.last_seen_at || 0).getTime();

        const entry = groupedDevices.get(key);
        if (!entry) {
          groupedDevices.set(key, {
            sessions: [s],
            latestSession: s,
            firstConnectedMs: createdMs || lastSeenMs,
            lastSeenMs: lastSeenMs || createdMs,
          });
        } else {
          entry.sessions.push(s);
          if (createdMs && createdMs < entry.firstConnectedMs) {
            entry.firstConnectedMs = createdMs;
          }
          if (lastSeenMs && lastSeenMs > entry.lastSeenMs) {
            entry.lastSeenMs = lastSeenMs;
            entry.latestSession = s;
          }
        }
      }

      let devices = Array.from(groupedDevices.values()).map(({ sessions: devSessions, latestSession, firstConnectedMs, lastSeenMs }) => {
        const hasActive = devSessions.some((s: any) => s.revoked_at == null);
        const activeSession = devSessions.find((s: any) => s.revoked_at == null) || latestSession;

        // Calcul de la période de connexion
        const startDate = new Date(firstConnectedMs);
        const endDate = new Date(lastSeenMs);
        const startDay = startDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const endDay = endDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const startTime = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const endTime = endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const diffMs = Math.max(0, lastSeenMs - firstConnectedMs);
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        let durationText = '';
        if (diffDays > 0) {
          const remainingHours = diffHours % 24;
          durationText = remainingHours > 0 ? `${diffDays} j ${remainingHours} h` : `${diffDays} j`;
        } else if (diffHours > 0) {
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          durationText = `${diffHours} h ${diffMins} min`;
        } else {
          const diffMins = Math.floor(diffMs / (1000 * 60));
          durationText = `${Math.max(1, diffMins)} min`;
        }

        let connectionPeriod = '';
        if (startDay === endDay) {
          connectionPeriod = `Le ${startDay} (${startTime} → ${endTime} • ${durationText})`;
        } else {
          connectionPeriod = `Du ${startDay} au ${endDay} (${durationText})`;
        }

        return {
          sessionId: String(activeSession.id),
          tenantId: `tenant-${latestSession.shop_id}`,
          tenantName: shopMap.get(latestSession.shop_id) || `Entreprise #${latestSession.shop_id}`,
          userId: latestSession.user_id,
          deviceId: latestSession.device_id || `dev-${latestSession.id}`,
          label: latestSession.device_label || 'Appareil POS / Mobile',
          firstConnectedAt: new Date(firstConnectedMs).toISOString(),
          lastSeenAt: new Date(lastSeenMs).toISOString(),
          connectionPeriod,
          durationText,
          totalSessions: devSessions.length,
          status: hasActive ? 'ACTIVE' : 'REVOKED',
        };
      });

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
      const { data: target } = await db
        .from('user_sessions')
        .select('device_id, shop_id')
        .eq('id', sessionId)
        .maybeSingle();

      if (target?.device_id) {
        await db
          .from('user_sessions')
          .update({ revoked_at: timestamp })
          .eq('shop_id', target.shop_id)
          .eq('device_id', target.device_id);
      } else {
        await db.from('user_sessions').update({ revoked_at: timestamp }).eq('id', sessionId);
      }
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
