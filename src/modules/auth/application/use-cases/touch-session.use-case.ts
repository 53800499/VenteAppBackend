import { Injectable, UnauthorizedException } from '@nestjs/common';
import { msFromMinutes, nowMs } from '../../../../shared/utils/time.util';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { UserSessionRepository } from '../../domain/repositories/user-session.repository';

@Injectable()
export class TouchSessionUseCase {
  constructor(
    private readonly sessions: UserSessionRepository,
    private readonly settings: SettingsRepository,
  ) {}

  async execute(sessionId: string, shopId: number): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.isRevoked()) {
      throw new UnauthorizedException('Session invalide.');
    }
    // Si seule session_expires_at est dépassée mais le refresh JWT est actif,
    // on prolonge (même logique que SessionGuard) au lieu d'échouer.
    if (session.sessionExpiresAt <= nowMs() && !session.isRefreshActive(nowMs())) {
      throw new UnauthorizedException('Session expirée.');
    }

    const shopSettings =
      (await this.settings.findByShopId(shopId)) ??
      this.settings.getDefault(shopId);
    const timestamp = nowMs();
    const sessionExpiresAt = timestamp + msFromMinutes(Math.max(shopSettings.autoLockMinutes, 60));

    await this.sessions.touchById(sessionId, timestamp, sessionExpiresAt);
  }
}
