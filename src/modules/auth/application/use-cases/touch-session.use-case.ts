import { Injectable, UnauthorizedException } from '@nestjs/common';
import { msFromMinutes, nowMs } from '../../../../shared/utils/time.util';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { AuthSessionRepository } from '../../domain/repositories/auth-session.repository';

@Injectable()
export class TouchSessionUseCase {
  constructor(
    private readonly sessions: AuthSessionRepository,
    private readonly settings: SettingsRepository,
  ) {}

  async execute(sessionToken: string, shopId: number): Promise<void> {
    const session = await this.sessions.findByIdAndShop(sessionToken, shopId);
    if (!session) throw new UnauthorizedException('Session invalide.');
    if (session.expiresAt <= nowMs()) throw new UnauthorizedException('Session expirée.');

    const shopSettings = (await this.settings.findByShopId(session.shopId)) ??
      this.settings.getDefault(session.shopId);
    const timestamp = nowMs();
    const newExpiry = timestamp + msFromMinutes(shopSettings.autoLockMinutes);

    await this.sessions.touchInShop(sessionToken, session.shopId, timestamp, newExpiry);
  }
}
