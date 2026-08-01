import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission } from '../../../../shared/enums/permission.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { AuthTokenService } from '../../domain/services/auth-token.service';
import { UserSessionRepository } from '../../domain/repositories/user-session.repository';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopOwnershipService } from '../../../shops/domain/services/shop-ownership.service';
import { AuthPresenter } from '../../presentation/presenters/auth.presenter';

@Injectable()
export class RefreshTokensUseCase {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly sessions: UserSessionRepository,
    private readonly users: UserRepository,
    private readonly ownership: ShopOwnershipService,
    private readonly settings: SettingsRepository,
    private readonly presenter: AuthPresenter,
  ) {}

  async execute(refreshToken: string) {
    const session = await this.authTokenService.validateRefreshToken(refreshToken);
    const timestamp = nowMs();


    const user =
      (await this.users.findByIdAndShop(session.userId, session.shopId)) ??
      (await this.ownership.resolveUserForShop(session.userId, session.shopId));
    if (!user || !user.isActive) {
      throw new NotFoundException('Utilisateur introuvable ou désactivé.');
    }

    const shopSettings =
      (await this.settings.findByShopId(session.shopId)) ??
      this.settings.getDefault(session.shopId);

    const tokens = await this.authTokenService.issueTokenPairForSession(session, user, shopSettings);
    const updated = await this.sessions.findById(session.id);

    return this.presenter.presentTokenRefresh({
      session: updated!,
      user,
      tokens,
    });
  }
}

@Injectable()
export class LogoutUseCase {
  constructor(private readonly authTokenService: AuthTokenService) {}

  async execute(sessionId: string) {
    await this.authTokenService.revokeSession(sessionId);
    return { loggedOut: true };
  }
}

@Injectable()
export class ListDeviceSessionsUseCase {
  constructor(
    private readonly sessions: UserSessionRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(auth: AuthContext, scope: 'mine' | 'shop') {
    const rows =
      scope === 'shop'
        ? await this.sessions.listActiveByShop(auth.shopId)
        : await this.sessions.listActiveByUser(auth.userId);

    const userNames = await this.resolveUserNames(rows.map((s) => s.userId), auth.shopId);

    return rows.map((session) => ({
      id: session.id,
      userId: session.userId,
      userName: userNames.get(session.userId) ?? `Utilisateur #${session.userId}`,
      deviceId: session.deviceId,
      deviceLabel: session.deviceLabel,
      lastSeenAt: session.lastSeenAt,
      sessionExpiresAt: session.sessionExpiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
      isCurrent: session.id === auth.sessionId,
    }));
  }

  private async resolveUserNames(userIds: number[], shopId: number) {
    const unique = [...new Set(userIds)];
    const map = new Map<number, string>();
    await Promise.all(
      unique.map(async (id) => {
        const user = await this.users.findByIdAndShop(id, shopId);
        if (user) map.set(id, user.name);
      }),
    );
    return map;
  }
}

import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUTH_EVENTS, DeviceRevokedEvent } from '../../../../core/events/auth.events';

@Injectable()
export class RevokeDeviceSessionUseCase {
  constructor(
    private readonly sessions: UserSessionRepository,
    private readonly authTokenService: AuthTokenService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(auth: AuthContext, sessionId: string) {
    const target = await this.sessions.findByIdAndShop(sessionId, auth.shopId);
    if (!target || target.isRevoked()) {
      throw new NotFoundException('Session introuvable.');
    }

    const isOwn = target.userId === auth.userId;
    const canManageShop = auth.permissions.includes(Permission.USERS_READ);

    if (!isOwn && !canManageShop) {
      throw new ForbiddenException('Vous ne pouvez révoquer que vos propres appareils.');
    }

    await this.authTokenService.revokeSession(sessionId);
    this.events.emit(AUTH_EVENTS.DEVICE_REVOKED, new DeviceRevokedEvent(sessionId, auth.shopId));
    return { id: sessionId, revoked: true };
  }
}
