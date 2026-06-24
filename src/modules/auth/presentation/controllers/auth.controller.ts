import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  BadRequestException,
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
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUserId, SessionToken } from '../../../../shared/decorators/auth.decorators';
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
  EmergencyUnlockResponseDto,
  EnableBiometricResponseDto,
  LockScreenResponseDto,
  LoginSuccessResponseDto,
  SetupOwnerResponseDto,
  TouchSessionResponseDto,
} from '../../application/dto/auth-response.dto';
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
import { SetupOwnerUseCase } from '../../application/use-cases/setup-owner.use-case';
import { TouchSessionUseCase } from '../../application/use-cases/touch-session.use-case';

@ApiTags('Authentification')
@Controller('auth')
@UseInterceptors(TransformResponseInterceptor)
export class AuthController {
  constructor(
    private readonly getLockScreen: GetLockScreenUseCase,
    private readonly setupOwner: SetupOwnerUseCase,
    private readonly loginWithPin: LoginWithPinUseCase,
    private readonly emergencyUnlock: EmergencyUnlockUseCase,
    private readonly enableBiometric: EnableBiometricUseCase,
    private readonly touchSession: TouchSessionUseCase,
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
      '- PIN incorrect → message avec tentatives restantes [RG-AUTH-03]',
      '- 5 échecs → verrouillage 15 min',
      '- 3 blocages successifs → fichier de récupération requis [RG-AUTH-04]',
    ].join('\n'),
  })
  @ApiOkResponse({ type: LoginSuccessResponseDto, description: 'Connexion réussie — session créée' })
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
    return this.loginWithPin.execute({ pin: dto.pin, shopId, userId: dto.userId });
  }

  @Post('setup')
  @ApiOperation({
    summary: 'Installation initiale',
    description: [
      '**RG-AUTH-08** — Crée la boutique, le compte patron et génère le fichier de récupération d\'urgence.',
      'Ne peut être exécuté qu\'une seule fois.',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: SetupOwnerResponseDto })
  @ApiConflictResponse({ type: ConflictErrorDto, description: 'Installation déjà effectuée' })
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
    ].join('\n'),
  })
  @ApiOkResponse({ type: EmergencyUnlockResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Fichier de récupération invalide' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Aucun fichier de récupération configuré' })
  @ApiNotFoundResponse({ type: NotFoundErrorDto })
  async emergencyUnlockHandler(@Body() dto: EmergencyUnlockDto) {
    const shopId = dto.shopId ?? this.tenantContext.getShopId() ?? 1;
    await this.bindTenant(shopId);
    return this.emergencyUnlock.execute({ ...dto, shopId });
  }

  @Post('biometric/enable')
  @UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUTH_BIOMETRIC_ENABLE)
  @ApiSecurity('session-token')
  @ApiSecurity('user-id')
  @ApiOperation({
    summary: 'Activer la biométrie',
    description: '**RG-AUTH-05** — Nécessite une session PIN valide et la confirmation du PIN courant.',
  })
  @ApiOkResponse({ type: EnableBiometricResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Session invalide ou PIN incorrect' })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  enableBiometricHandler(
    @SessionToken() sessionToken: string,
    @CurrentUserId() userId: number,
    @Body() dto: EnableBiometricDto,
  ) {
    return this.enableBiometric.execute({ userId, pin: dto.pin, sessionToken });
  }

  @Post('session/touch')
  @UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUTH_SESSION_TOUCH)
  @ApiSecurity('session-token')
  @ApiOperation({
    summary: 'Prolonger la session',
    description: '**RG-AUTH-07** — Réinitialise le timer d\'inactivité (`auto_lock_minutes`, défaut 5 min).',
  })
  @ApiOkResponse({ type: TouchSessionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Session invalide ou expirée' })
  touchSessionHandler(@CurrentAuth() auth: AuthContext, @SessionToken() sessionToken: string) {
    return this.touchSession.execute(sessionToken, auth.shopId);
  }
}
