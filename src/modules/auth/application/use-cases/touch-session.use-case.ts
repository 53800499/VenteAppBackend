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
    if (session.sessionExpiresAt <= nowMs()) {
      throw new UnauthorizedException('Session expirée.');
    }

    const shopSettings =
      (await this.settings.findByShopId(shopId)) ??
      this.settings.getDefault(shopId);
    const timestamp = nowMs();
    const sessionExpiresAt = timestamp + msFromMinutes(shopSettings.autoLockMinutes);

    await this.sessions.touchById(sessionId, timestamp, sessionExpiresAt);
  }
}
