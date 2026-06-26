import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUserId } from '../../../../shared/decorators/auth.decorators';
import {
  AccountLockedErrorDto,
  ApiErrorDto,
  ConflictErrorDto,
  EmergencyRecoveryRequiredErrorDto,
  InvalidPinErrorDto,
  MaxAttemptsLockoutErrorDto,
  NotFoundErrorDto,
  ValidationErrorDto,
} from '../../../../shared/dto/api-error.dto';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { Permission } from '../../../../shared/enums/permission.enum';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantContextService } from '../../../tenants/tenant-context.service';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { TenantGuard } from '../../../tenants/tenant.guard';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import {
  DeviceSessionListResponseDto,
  EmergencyUnlockResponseDto,
  EnableBiometricResponseDto,
  LockScreenResponseDto,
  LoginSuccessResponseDto,
  LogoutResponseDto,
  RevokeDeviceSessionResponseDto,
  SetupOwnerResponseDto,
  SwitchShopResponseDto,
  TokenRefreshResponseDto,
  TouchSessionResponseDto,
} from '../../application/dto/auth-response.dto';
import { RefreshTokenDto } from '../../application/dto/refresh-token.dto';
import { LoginPinDto } from '../../application/dto/login-pin.dto';
import {
  EmergencyUnlockDto,
  EnableBiometricDto,
  SetupOwnerDto,
} from '../../application/dto/setup-auth.dto';
import { EmergencyUnlockUseCase } from '../../application/use-cases/emergency-unlock.use-case';
import { EnableBiometricUseCase } from '../../application/use-cases/enable-biometric.use-case';
import { GetLockScreenUseCase } from '../../application/use-cases/get-lock-screen.use-case';
import { LoginWithPinUseCase } from '../../application/use-cases/login-with-pin.use-case';
import {
  ListDeviceSessionsUseCase,
  LogoutUseCase,
  RefreshTokensUseCase,
  RevokeDeviceSessionUseCase,
} from '../../application/use-cases/jwt-auth.use-cases';
import { SetupOwnerUseCase } from '../../application/use-cases/setup-owner.use-case';
import { SwitchShopUseCase } from '../../application/use-cases/switch-shop.use-case';
import { SwitchShopDto } from '../../application/dto/switch-shop.dto';
import { TouchSessionUseCase } from '../../application/use-cases/touch-session.use-case';
import {
  CompleteWhatsappOtpLoginDto,
  RequestWhatsappOtpDto,
  RequestWhatsappOtpResponseDto,
  VerifyWhatsappOtpDto,
  VerifyWhatsappOtpResponseDto,
} from '../../application/dto/whatsapp-otp.dto';
import {
  CompleteWhatsappOtpLoginUseCase,
  RequestWhatsappOtpUseCase,
  VerifyWhatsappOtpUseCase,
} from '../../application/use-cases/whatsapp-otp.use-cases';
import { CheckSetupAvailableUseCase } from '../../application/use-cases/check-setup-available.use-case';

@ApiTags('Authentification')
@Controller('auth')
@UseInterceptors(TransformResponseInterceptor)
export class AuthController {
  constructor(
    private readonly getLockScreen: GetLockScreenUseCase,
    private readonly setupOwner: SetupOwnerUseCase,
    private readonly checkSetupAvailable: CheckSetupAvailableUseCase,
    private readonly loginWithPin: LoginWithPinUseCase,
    private readonly emergencyUnlock: EmergencyUnlockUseCase,
    private readonly enableBiometric: EnableBiometricUseCase,
    private readonly touchSession: TouchSessionUseCase,
    private readonly refreshTokens: RefreshTokensUseCase,
    private readonly logout: LogoutUseCase,
    private readonly listDeviceSessions: ListDeviceSessionsUseCase,
    private readonly revokeDeviceSession: RevokeDeviceSessionUseCase,
    private readonly switchShop: SwitchShopUseCase,
    private readonly requestWhatsappOtp: RequestWhatsappOtpUseCase,
    private readonly verifyWhatsappOtp: VerifyWhatsappOtpUseCase,
    private readonly completeWhatsappOtpLogin: CompleteWhatsappOtpLoginUseCase,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  private async bindTenant(shopId: number) {
    this.tenantContext.setShopId(shopId);
    await this.tenantDb.setShopId(shopId);
  }

  @Get('lock-screen/:shopId')
  @ApiOperation({
    summary: 'Données écran de verrouillage PIN',
    description: '**ECR-01** — Retourne le nom de la boutique active et la liste des utilisateurs pour l\'écran PIN.',
  })
  @ApiParam({ name: 'shopId', example: 1, description: 'ID de la boutique active' })
  @ApiOkResponse({ type: LockScreenResponseDto })
  @ApiNotFoundResponse({ type: NotFoundErrorDto, description: 'Boutique introuvable' })
  async getLockScreenHandler(@Param('shopId', ParseIntPipe) shopId: number) {
    await this.bindTenant(shopId);
    return this.getLockScreen.execute({ shopId });
  }

  @Post('pin/login')
  @ApiOperation({
    summary: 'Connexion par PIN',
    description: [
      '**UC-01** — Vérifie le hash bcrypt du PIN [RG-AUTH-02].',
      '- `deviceId` obligatoire (UUID stable côté client)',
      '- Re-login sur le même appareil révoque l\'ancienne session',
      '- PIN incorrect → message avec tentatives restantes [RG-AUTH-03]',
      '- 5 échecs → verrouillage 15 min',
      '- 3 blocages successifs → fichier de récupération requis [RG-AUTH-04]',
    ].join('\n'),
  })
  @ApiOkResponse({ type: LoginSuccessResponseDto, description: 'Connexion réussie — JWT + refresh token émis' })
  @ApiUnauthorizedResponse({ type: InvalidPinErrorDto, description: 'PIN incorrect' })
  @ApiForbiddenResponse({
    type: AccountLockedErrorDto,
    description: 'Compte temporairement verrouillé (15 min)',
  })
  @ApiForbiddenResponse({
    type: MaxAttemptsLockoutErrorDto,
    description: 'Verrouillage après 5 tentatives échouées',
  })
  @ApiForbiddenResponse({
    type: EmergencyRecoveryRequiredErrorDto,
    description: 'Déblocage PIN impossible — récupération d\'urgence requise',
  })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  @ApiNotFoundResponse({ type: NotFoundErrorDto, description: 'Utilisateur introuvable' })
  async loginWithPinHandler(@Body() dto: LoginPinDto) {
    const shopId = dto.shopId ?? this.tenantContext.getShopId() ?? 1;
    await this.bindTenant(shopId);
    return this.loginWithPin.execute({
      pin: dto.pin,
      shopId,
      userId: dto.userId,
      deviceId: dto.deviceId,
      deviceLabel: dto.deviceLabel,
    });
  }

  @Post('whatsapp/otp/request')
  @ApiOperation({
    summary: 'Demander un code OTP via WhatsApp',
    description: 'Envoie un code à 6 chiffres sur WhatsApp. Le numéro doit être enregistré sur un compte.',
  })
  @ApiOkResponse({ type: RequestWhatsappOtpResponseDto })
  @ApiNotFoundResponse({ description: 'Numéro non enregistré' })
  requestWhatsappOtpHandler(@Body() dto: RequestWhatsappOtpDto) {
    return this.requestWhatsappOtp.execute(dto.phone);
  }

  @Post('whatsapp/otp/verify')
  @ApiOperation({
    summary: 'Vérifier le code WhatsApp',
    description: 'Retourne les boutiques accessibles et un jeton de sélection de contexte.',
  })
  @ApiOkResponse({ type: VerifyWhatsappOtpResponseDto })
  @ApiUnauthorizedResponse({ description: 'Code invalide ou expiré' })
  verifyWhatsappOtpHandler(@Body() dto: VerifyWhatsappOtpDto) {
    return this.verifyWhatsappOtp.execute(dto.phone, dto.code);
  }

  @Post('whatsapp/otp/complete')
  @ApiOperation({
    summary: 'Finaliser la connexion WhatsApp',
    description: 'Émet JWT après choix de la boutique. Même payload que le login PIN.',
  })
  @ApiOkResponse({ type: LoginSuccessResponseDto })
  async completeWhatsappOtpHandler(@Body() dto: CompleteWhatsappOtpLoginDto) {
    await this.bindTenant(dto.shopId);
    return this.completeWhatsappOtpLogin.execute(dto);
  }

  @Get('setup/available')
  @ApiOperation({
    summary: 'Vérifier si la création de boutique est possible',
    description: [
      'Retourne toujours `available: true` pour afficher l\'accès à l\'installation.',
      '`initialSetup: true` uniquement si aucun compte n\'existe encore sur ce serveur.',
    ].join('\n'),
  })
  @ApiOkResponse({ description: 'État de l\'installation / création boutique' })
  setupAvailableHandler() {
    return this.checkSetupAvailable.execute();
  }

  @Post('setup')
  @ApiOperation({
    summary: 'Créer une boutique et un compte patron',
    description: [
      '**RG-AUTH-08** — Crée une boutique, un compte patron et génère le fichier de récupération d\'urgence.',
      'Accessible même si d\'autres comptes existent déjà (nouvelle entreprise).',
      'Pour ajouter une boutique à un patron existant, utiliser `POST /api/shops` après connexion.',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: SetupOwnerResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  setupOwnerHandler(@Body() dto: SetupOwnerDto) {
    return this.setupOwner.execute(dto);
  }

  @Post('emergency-unlock')
  @ApiOperation({
    summary: 'Déblocage d\'urgence',
    description: [
      '**RG-AUTH-04 / RG-AUTH-09** — Débloque le compte via le fichier de récupération.',
      'Génère automatiquement une entrée dans le journal d\'audit (`emergency_unlock`).',
      'Requiert `deviceId` comme pour le login PIN.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: EmergencyUnlockResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Fichier de récupération invalide' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Aucun fichier de récupération configuré' })
  @ApiNotFoundResponse({ type: NotFoundErrorDto })
  async emergencyUnlockHandler(@Body() dto: EmergencyUnlockDto) {
    const shopId = dto.shopId ?? this.tenantContext.getShopId() ?? 1;
    await this.bindTenant(shopId);
    return this.emergencyUnlock.execute({
      recoveryToken: dto.recoveryToken,
      shopId,
      userId: dto.userId,
      deviceId: dto.deviceId,
      deviceLabel: dto.deviceLabel,
    });
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Renouveler les jetons (rotation refresh)',
    description: [
      'Route publique — échange un refresh token valide contre une nouvelle paire access + refresh.',
      'L\'ancien refresh token est invalidé (rotation sur la même ligne `user_sessions`).',
      'La session applicative doit encore être active (inactivité RG-AUTH-07).',
    ].join('\n'),
  })
  @ApiOkResponse({ type: TokenRefreshResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Refresh token invalide, expiré ou révoqué' })
  refreshTokensHandler(@Body() dto: RefreshTokenDto) {
    return this.refreshTokens.execute(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(SessionGuard, TenantGuard)
  @ApiSecurity('bearer')
  @ApiOperation({
    summary: 'Déconnexion',
    description: [
      'Révoque la session courante (`user_sessions.revoked_at`).',
      'Requiert `Authorization: Bearer <accessToken>`.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  logoutHandler(@CurrentAuth() auth: AuthContext) {
    return this.logout.execute(auth.sessionId);
  }

  @Post('switch-shop')
  @UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHOPS_SWITCH)
  @ApiSecurity('bearer')
  @ApiOperation({
    summary: 'Définir la boutique par défaut de la session',
    description: [
      '**RG-SHOP-06** — Réservé au patron (`shops:switch`).',
      'Met à jour la boutique par défaut en base (`user_sessions.shop_id`).',
      'Le JWT ne contient pas de `shopId` : utilisez `X-Shop-Id` par requête ou cette route pour changer le défaut.',
      'Aucun nouveau jeton n\'est émis.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: SwitchShopResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: NotFoundErrorDto })
  switchShopHandler(@CurrentAuth() auth: AuthContext, @Body() dto: SwitchShopDto) {
    return this.switchShop.execute(auth, dto.shopId);
  }

  @Get('devices')
  @UseGuards(SessionGuard, TenantGuard)
  @ApiSecurity('bearer')
  @ApiOperation({
    summary: 'Lister les appareils connectés',
    description: [
      'Par défaut : sessions actives de l\'utilisateur courant.',
      'Avec `?all=true` et permission `users:read` : toutes les sessions actives de la boutique (patron).',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'all',
    required: false,
    type: Boolean,
    description: 'Lister toutes les sessions de la boutique (nécessite `users:read`)',
  })
  @ApiOkResponse({ type: DeviceSessionListResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Permission `users:read` requise pour `all=true`' })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  listDevicesHandler(@CurrentAuth() auth: AuthContext, @Query('all') all?: string) {
    const scopeAll = all === 'true';
    if (scopeAll && !auth.permissions.includes(Permission.USERS_READ)) {
      throw new ForbiddenException('Permission users:read requise pour lister tous les appareils de la boutique.');
    }
    return this.listDeviceSessions.execute(auth, scopeAll ? 'shop' : 'mine');
  }

  @Delete('devices/:id')
  @UseGuards(SessionGuard, TenantGuard)
  @ApiSecurity('bearer')
  @ApiOperation({
    summary: 'Révoquer un appareil / session',
    description: [
      'Révoque une session active par son ID.',
      '- Session propre : toujours autorisé',
      '- Session d\'un autre utilisateur : permission `users:read` (patron)',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', description: 'UUID de la session (`user_sessions.id`)' })
  @ApiOkResponse({ type: RevokeDeviceSessionResponseDto })
  @ApiNotFoundResponse({ type: NotFoundErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  revokeDeviceHandler(@CurrentAuth() auth: AuthContext, @Param('id') sessionId: string) {
    return this.revokeDeviceSession.execute(auth, sessionId);
  }

  @Post('biometric/enable')
  @UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUTH_BIOMETRIC_ENABLE)
  @ApiSecurity('bearer')
  @ApiOperation({
    summary: 'Activer la biométrie',
    description: [
      '**Permission** : `auth:biometric:enable`',
      '',
      '**RG-AUTH-05** — Nécessite une session PIN valide et la confirmation du PIN courant.',
      'Active le déverrouillage biométrique pour l\'utilisateur connecté.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: EnableBiometricResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Session invalide ou PIN incorrect' })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  enableBiometricHandler(
    @CurrentAuth() auth: AuthContext,
    @CurrentUserId() userId: number,
    @Body() dto: EnableBiometricDto,
  ) {
    return this.enableBiometric.execute({ userId, pin: dto.pin, sessionId: auth.sessionId });
  }

  @Post('session/touch')
  @UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUTH_SESSION_TOUCH)
  @ApiSecurity('bearer')
  @ApiOperation({
    summary: 'Prolonger la session',
    description: [
      '**Permission** : `auth:session:touch`',
      '',
      '**RG-AUTH-07** — Réinitialise le timer d\'inactivité (`auto_lock_minutes`, défaut 5 min).',
      'À appeler périodiquement depuis le client tant que l\'utilisateur est actif.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: TouchSessionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Session invalide ou expirée' })
  touchSessionHandler(@CurrentAuth() auth: AuthContext) {
    return this.touchSession.execute(auth.sessionId, auth.shopId);
  }
}
