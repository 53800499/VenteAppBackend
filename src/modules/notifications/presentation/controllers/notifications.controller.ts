import { Body, Controller, Get, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { Permission } from '../../../../shared/enums/permission.enum';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantGuard } from '../../../tenants/tenant.guard';
import {
  AckNotificationDto,
  AckNotificationResponseDto,
  NotificationFeedDto,
  NotificationPreferencesDto,
  UpdateNotificationSettingsDto,
} from '../../application/dto/notification.dto';
import {
  AckNotificationsUseCase,
  GetNotificationSettingsUseCase,
  GetPendingNotificationsUseCase,
  UpdateNotificationSettingsUseCase,
} from '../../application/use-cases/notification.use-cases';

@ApiTags('Notifications')
@Controller('notifications')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class NotificationsController {
  constructor(
    private readonly getSettings: GetNotificationSettingsUseCase,
    private readonly updateSettings: UpdateNotificationSettingsUseCase,
    private readonly getPending: GetPendingNotificationsUseCase,
    private readonly ack: AckNotificationsUseCase,
  ) {}

  @Get('settings')
  @RequirePermissions(Permission.SETTINGS_READ)
  @ApiOperation({
    summary: 'Préférences notifications (Module 9)',
    description: 'RG-NOTIF-01 : canaux configurables par boutique (stock, dettes, résumé, sauvegarde, bonne journée).',
  })
  @ApiOkResponse({ type: NotificationPreferencesDto })
  settings(@CurrentAuth() auth: AuthContext) {
    return this.getSettings.execute(auth);
  }

  @Patch('settings')
  @RequirePermissions(Permission.SETTINGS_WRITE)
  @ApiOperation({
    summary: 'Mettre à jour les préférences notifications',
    description: 'Patron / utilisateur avec `settings:write`. N-07 (conflits sync) reste toujours actif.',
  })
  @ApiOkResponse({ type: NotificationPreferencesDto })
  @ApiBadRequestResponse({ description: 'Validation ou corps vide' })
  patchSettings(@CurrentAuth() auth: AuthContext, @Body() body: UpdateNotificationSettingsDto) {
    return this.updateSettings.execute(auth, body);
  }

  @Get('pending')
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({
    summary: 'Candidats de notifications locales (Module 9)',
    description: [
      'Le mobile interroge cet endpoint pour afficher des notifications **locales** (`flutter_local_notifications`).',
      '',
      '| Code | Description |',
      '|------|-------------|',
      '| N-01 | Stock faible |',
      '| N-02 | Rappel dette (max 3/jour, RG-NOTIF-03) |',
      '| N-03 | Résumé journalier — voir `dailySummary` (RG-NOTIF-04) |',
      '| N-04 | Dette soldée — déclenché côté client après remboursement |',
      '| N-05 | Sauvegarde > 7 jours |',
      '| N-06 | Record CA du mois |',
      '| N-07 | Conflit sync (non désactivable) |',
    ].join('\n'),
  })
  @ApiOkResponse({ type: NotificationFeedDto })
  pending(@CurrentAuth() auth: AuthContext) {
    return this.getPending.execute(auth);
  }

  @Post('ack')
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({
    summary: 'Acquitter des notifications affichées',
    description: 'Incrémente le compteur journalier des rappels dette (RG-NOTIF-03) après affichage local.',
  })
  @ApiOkResponse({ type: AckNotificationResponseDto })
  @ApiBadRequestResponse({ description: 'Quota dépassé' })
  acknowledge(@CurrentAuth() auth: AuthContext, @Body() body: AckNotificationDto) {
    return this.ack.execute(auth, body.type, body.count);
  }
}
