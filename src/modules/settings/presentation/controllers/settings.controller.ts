import { Body, Controller, Get, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
  RecordBackupDto,
  RecordBackupResponseDto,
  SettingsResponseDto,
  UpdateSettingsDto,
  UpdateSyncSettingsDto,
  UpdateSyncSettingsResponseDto,
} from '../../application/dto/settings.dto';
import {
  GetSettingsUseCase,
  RecordBackupUseCase,
  UpdateSettingsUseCase,
  UpdateSyncSettingsUseCase,
} from '../../application/use-cases/settings.use-cases';

@ApiTags('Paramètres & Configuration')
@Controller('settings')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class SettingsController {
  constructor(
    private readonly getSettings: GetSettingsUseCase,
    private readonly updateSettings: UpdateSettingsUseCase,
    private readonly recordBackup: RecordBackupUseCase,
    private readonly updateSync: UpdateSyncSettingsUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.SETTINGS_READ)
  @ApiOperation({
    summary: 'Configuration boutique (Module 10)',
    description: [
      '**Sections** : Boutique, Localisation, Inventaire, Sécurité, Reçus, Sauvegarde, Sync.',
      '',
      '**RG-PARAM-01** : `currency` toujours `FCFA` (lecture seule).',
      '**RG-PARAM-02** : le nom boutique est obligatoire à la modification.',
      'Les préférences **notifications** restent sur `GET /api/notifications/settings`.',
      'Changement PIN / biométrie : module Authentification.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: SettingsResponseDto })
  @ApiNotFoundResponse({ description: 'Paramètres introuvables' })
  @ApiForbiddenResponse({ description: 'Permission `settings:read` requise' })
  settings(@CurrentAuth() auth: AuthContext) {
    return this.getSettings.execute(auth);
  }

  @Patch()
  @RequirePermissions(Permission.SETTINGS_WRITE)
  @ApiOperation({
    summary: 'Mettre à jour la configuration',
    description: 'Patron ou utilisateur avec `settings:write`. Synchronise `shops` si identité boutique modifiée.',
  })
  @ApiOkResponse({ type: SettingsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation métier (RG-PARAM)' })
  patchSettings(@CurrentAuth() auth: AuthContext, @Body() body: UpdateSettingsDto) {
    return this.updateSettings.execute(auth, body);
  }

  @Post('backup')
  @RequirePermissions(Permission.SETTINGS_WRITE)
  @ApiOperation({
    summary: 'Enregistrer une sauvegarde réussie',
    description: [
      'Le mobile génère le fichier `.venteapp` localement (RG-PARAM-04).',
      'Cet endpoint met à jour `backup.lastAt` pour les alertes N-05 et l\'écran Paramètres.',
      'RG-PARAM-05 à 09 : vérifications espace, chiffrement et restauration côté client.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: RecordBackupResponseDto })
  recordBackupComplete(@CurrentAuth() auth: AuthContext, @Body() body: RecordBackupDto) {
    return this.recordBackup.execute(auth, body);
  }

  @Patch('sync')
  @RequirePermissions(Permission.SETTINGS_WRITE)
  @ApiOperation({
    summary: 'Paramètres synchronisation cloud (V2)',
    description: 'Active/désactive la sync cloud et enregistre la date de dernière sync réussie.',
  })
  @ApiOkResponse({ type: UpdateSyncSettingsResponseDto })
  patchSync(@CurrentAuth() auth: AuthContext, @Body() body: UpdateSyncSettingsDto) {
    return this.updateSync.execute(auth, body);
  }
}
