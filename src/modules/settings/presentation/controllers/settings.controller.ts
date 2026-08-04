import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
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
import { SettingsScopeResolverService } from '../../domain/services/settings-scope-resolver.service';
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
    private readonly scopeResolver: SettingsScopeResolverService,
  ) {}

  @Get('effective')
  @RequirePermissions(Permission.SETTINGS_READ)
  @ApiOperation({
    summary: 'Calculer le snapshot effectif des paramètres pour la boutique active (Policy Engine)',
    description: 'Calcule la résolution hiérarchique : Plateforme -> Organisation -> Boutique -> Utilisateur',
  })
  async getEffectiveSnapshot(@CurrentAuth() auth: AuthContext) {
    const rawSettings = await this.getSettings.execute(auth);
    return this.scopeResolver.resolveEffectiveSnapshot({
      shopId: String(auth.shopId),
      shopSettings: {
        'company.name': rawSettings.shopName,
        'company.phone': rawSettings.shopPhone,
        'company.address': rawSettings.shopAddress,
        'inventory.defaultAlertThreshold': rawSettings.defaultAlertThreshold,
        'security.autoLockMinutes': rawSettings.autoLockMinutes,
        'receipts.receiptFooter': rawSettings.receiptFooter,
      },
      version: 1,
    });
  }

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

  @Get('tenant')
  @RequirePermissions(Permission.SETTINGS_READ)
  getTenantSettings() {
    return {
      name: 'ARIKE ERP',
      legalName: 'ARIKE SARL',
      tradeName: 'ARIKE',
      companyEmail: 'contact@arike.app',
      phone: '+22990123456',
      address: 'Cotonou, Bénin',
      primaryCurrency: 'XOF',
    };
  }

  @Put('tenant')
  @RequirePermissions(Permission.SETTINGS_WRITE)
  updateTenantSettings(@Body() body: any) {
    return {
      name: body.name || 'ARIKE ERP',
      legalName: body.legalName || 'ARIKE SARL',
      tradeName: body.tradeName || 'ARIKE',
      companyEmail: body.companyEmail || 'contact@arike.app',
      phone: body.phone || '+22990123456',
      address: body.address || 'Cotonou, Bénin',
      primaryCurrency: body.primaryCurrency || 'XOF',
    };
  }

  @Get('tax-rates')
  listTaxRates() {
    return [
      { id: '1', name: 'TVA Standard', rate: 18, isDefault: true },
      { id: '2', name: 'Exonéré', rate: 0, isDefault: false },
    ];
  }

  @Post('tax-rates')
  createTaxRate(@Body() body: any) {
    return { id: '3', name: body.name, rate: body.rate, isDefault: body.isDefault || false };
  }

  @Patch('tax-rates/:id')
  updateTaxRate(@Param('id') id: string, @Body() body: any) {
    return { id, name: body.name || 'TVA Modifiée', rate: body.rate || 18, isDefault: body.isDefault || false };
  }

  @Delete('tax-rates/:id')
  deleteTaxRate(@Param('id') id: string) {
    return { message: `Taux de taxe ${id} supprimé.` };
  }

  @Get('payment-terms')
  listPaymentTerms() {
    return [
      { id: '1', name: 'Comptant', days: 0, isDefault: true },
      { id: '2', name: '30 jours', days: 30, isDefault: false },
    ];
  }

  @Post('payment-terms')
  createPaymentTerm(@Body() body: any) {
    return { id: '3', name: body.name, days: body.days, isDefault: body.isDefault || false };
  }

  @Patch('payment-terms/:id')
  updatePaymentTerm(@Param('id') id: string, @Body() body: any) {
    return { id, name: body.name || 'Terme modifié', days: body.days || 30, isDefault: body.isDefault || false };
  }

  @Delete('payment-terms/:id')
  deletePaymentTerm(@Param('id') id: string) {
    return { message: `Condition de paiement ${id} supprimée.` };
  }

  @Get('currencies')
  listCurrencies() {
    return [
      { id: '1', code: 'XOF', symbol: 'FCFA', isPrimary: true },
      { id: '2', code: 'EUR', symbol: '€', isPrimary: false },
    ];
  }

  @Post('currencies')
  createCurrency(@Body() body: any) {
    return { id: '3', code: body.code, symbol: body.symbol, isPrimary: false };
  }

  @Patch('currencies/:id')
  updateCurrency(@Param('id') id: string, @Body() body: any) {
    return { id, code: body.code || 'USD', symbol: body.symbol || '$', isPrimary: false };
  }

  @Delete('currencies/:id')
  deleteCurrency(@Param('id') id: string) {
    return { message: `Devise ${id} supprimée.` };
  }

  @Get('numbering')
  listNumbering() {
    return [
      { documentType: 'invoice', prefix: 'FAC-', nextNumber: 1, padLength: 5 },
      { documentType: 'quote', prefix: 'DEV-', nextNumber: 1, padLength: 5 },
    ];
  }

  @Patch('numbering/:documentType')
  updateNumbering(@Param('documentType') documentType: string, @Body() body: any) {
    return { documentType, prefix: body.prefix || 'FAC-', nextNumber: body.nextNumber || 1, padLength: 5 };
  }

  @Get('email-templates')
  listEmailTemplates() {
    return [
      { type: 'invoice', subject: 'Votre facture {{number}}', body: 'Bonjour, veuillez trouver ci-joint votre facture.' },
    ];
  }

  @Get('email-templates/:type')
  getEmailTemplate(@Param('type') type: string) {
    return { type, subject: 'Votre document {{number}}', body: 'Bonjour, veuillez trouver ci-joint votre document.' };
  }

  @Put('email-templates/:type')
  updateEmailTemplate(@Param('type') type: string, @Body() body: any) {
    return { type, subject: body.subject || 'Sujet mis à jour', body: body.body || 'Contenu mis à jour' };
  }

  @Get('pdf-template')
  getPdfTemplate() {
    return { primaryColor: '#4F46E5', showLogo: true, footerText: 'Merci pour votre confiance.' };
  }

  @Put('pdf-template')
  updatePdfTemplate(@Body() body: any) {
    return { primaryColor: body.primaryColor || '#4F46E5', showLogo: body.showLogo ?? true, footerText: body.footerText || '' };
  }

  @Get('reminders')
  getRemindersSettings() {
    return { enabled: true, daysBeforeDue: 3, daysAfterDue: 7 };
  }

  @Put('reminders')
  updateRemindersSettings(@Body() body: any) {
    return { enabled: body.enabled ?? true, daysBeforeDue: body.daysBeforeDue || 3, daysAfterDue: body.daysAfterDue || 7 };
  }
}
