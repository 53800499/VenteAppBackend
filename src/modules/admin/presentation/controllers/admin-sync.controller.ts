import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../../shared/guards/admin.guard';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';

@ApiTags('Admin - Supervision Synchronisation')
@Controller('admin/sync')
@UseGuards(AdminGuard)
@ApiBearerAuth()
@UseInterceptors(TransformResponseInterceptor)
export class AdminSyncController {
  @Get('health')
  @ApiOperation({ summary: 'Santé globale du moteur de synchronisation cloud' })
  getSyncHealth() {
    return {
      status: 'HEALTHY',
      pendingTotalQueueCount: 0,
      blockedQueueCount: 0,
      conflictsTotalCount: 0,
      activeSyncNodes: 1,
      lastCycleAt: new Date().toISOString(),
      tenantsWithErrors: [],
    };
  }

  @Get('errors')
  @ApiOperation({ summary: 'Journal des erreurs de synchronisation par entreprise' })
  getSyncErrors() {
    return {
      totalErrors: 0,
      errorLog: [],
      evaluatedAt: new Date().toISOString(),
    };
  }
}
