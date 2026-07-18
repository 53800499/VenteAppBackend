import { Injectable } from '@nestjs/common';
import { PermissionService } from '../../../../core/security/permission.service';
import { IdentityRepository } from '../../../identity/domain/repositories/identity.repository';
import { UserSession } from '../../domain/entities/user-session.entity';
import { IssuedTokenPair } from '../../domain/interfaces/jwt-payload.interface';
import { User } from '../../../users/domain/entities/user.entity';
import { ShopSettings } from '../../../shops/domain/entities/shop.entity';

interface LoginPresentationInput {
  session: UserSession;
  user: User;
  settings: ShopSettings;
  shopId: number;
  shopName: string;
  tokens: IssuedTokenPair;
}

interface TokenRefreshInput {
  session: UserSession;
  user: User;
  tokens: IssuedTokenPair;
}

@Injectable()
export class AuthPresenter {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly identity: IdentityRepository,
  ) {}

  async presentLoginSuccess(input: LoginPresentationInput) {
    return this.buildAuthPayload(input, input.tokens);
  }

  async presentEmergencyUnlock(input: LoginPresentationInput) {
    return {
      ...(await this.presentLoginSuccess(input)),
      message: 'Déblocage d\'urgence réussi.',
    };
  }

  async presentTokenRefresh(input: TokenRefreshInput) {
    const effectiveRole =
      (await this.identity.resolveEffectiveRole(input.user.id, input.user.shopId)) ??
      input.user.role;
    const roleLabel = await this.permissionService.getRoleLabel(effectiveRole);
    return {
      ...this.mapTokens(input.tokens),
      user: {
        id: input.user.id,
        role: effectiveRole,
        roleLabel,
        shopId: input.user.shopId,
      },
      expiresAt: input.session.sessionExpiresAt,
    };
  }

  private async buildAuthPayload(input: LoginPresentationInput, tokens: IssuedTokenPair) {
    const effectiveRole =
      (await this.identity.resolveEffectiveRole(input.user.id, input.shopId)) ??
      input.user.role;
    const permissions = await this.permissionService.resolveForUser({
      userId: input.user.id,
      role: effectiveRole,
      shopId: input.shopId,
    });
    const roleLabel = await this.permissionService.getRoleLabel(effectiveRole);

    return {
      ...this.mapTokens(tokens),
      user: {
        id: input.user.id,
        name: input.user.name,
        role: effectiveRole,
        roleLabel,
        shopId: input.user.shopId,
        biometricEnabled: input.user.biometricEnabled,
        lastLoginAt: input.user.lastLoginAt,
        permissions,
      },
      shop: { id: input.shopId, name: input.shopName },
      autoLockMinutes: input.settings.autoLockMinutes,
      expiresAt: input.session.sessionExpiresAt,
    };
  }

  private mapTokens(tokens: IssuedTokenPair) {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      accessExpiresAt: tokens.accessExpiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
    };
  }
}
