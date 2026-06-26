import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import {
  ExpiredRefreshTokenException,
  InvalidAccessTokenException,
  InvalidRefreshTokenException,
} from '../../../../shared/exceptions/jwt-auth.exceptions';
import { msFromDays, msFromMinutes, nowMs } from '../../../../shared/utils/time.util';
import { User } from '../../../users/domain/entities/user.entity';
import { ShopSettings } from '../../../shops/domain/entities/shop.entity';
import { UserSession } from '../entities/user-session.entity';
import { JwtAccessPayload, IssuedTokenPair } from '../interfaces/jwt-payload.interface';
import { UserSessionRepository } from '../repositories/user-session.repository';

export interface DeviceInfo {
  deviceId: string;
  deviceLabel?: string | null;
}

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessions: UserSessionRepository,
    private readonly configService: ConfigService,
  ) {}

  hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async bootstrapSession(
    user: User,
    targetShopId: number,
    settings: ShopSettings,
    device: DeviceInfo,
  ): Promise<{ session: UserSession; tokens: IssuedTokenPair; refreshTokenRaw: string }> {
    const timestamp = nowMs();
    await this.sessions.revokeActiveByDevice(user.id, targetShopId, device.deviceId, timestamp);

    const refreshTokenRaw = randomBytes(32).toString('hex');
    const sessionExpiresAt = timestamp + msFromMinutes(settings.autoLockMinutes);
    const refreshExpiresAt = timestamp + this.getRefreshTtlMs();

    const session = await this.sessions.create({
      user_id: user.id,
      shop_id: targetShopId,
      device_id: device.deviceId,
      device_label: device.deviceLabel?.trim() || null,
      refresh_token_hash: this.hashRefreshToken(refreshTokenRaw),
      pin_verified_at: timestamp,
      last_seen_at: timestamp,
      session_expires_at: sessionExpiresAt,
      refresh_expires_at: refreshExpiresAt,
      created_at: timestamp,
    });

    const tokens = await this.signTokenPair(session, user, refreshTokenRaw, timestamp);
    return { session, tokens, refreshTokenRaw };
  }

  async issueTokenPairForSession(
    session: UserSession,
    user: User,
    settings: ShopSettings,
  ): Promise<IssuedTokenPair & { refreshToken: string }> {
    const timestamp = nowMs();
    const refreshTokenRaw = randomBytes(32).toString('hex');
    const sessionExpiresAt = timestamp + msFromMinutes(settings.autoLockMinutes);
    const refreshExpiresAt = timestamp + this.getRefreshTtlMs();

    await this.sessions.updateRefreshToken(
      session.id,
      this.hashRefreshToken(refreshTokenRaw),
      refreshExpiresAt,
      sessionExpiresAt,
      timestamp,
    );

    const tokens = await this.signTokenPair(session, user, refreshTokenRaw, timestamp);
    return { ...tokens, refreshToken: refreshTokenRaw };
  }

  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token);
      if (payload.type !== 'access' || !payload.sid) {
        throw new InvalidAccessTokenException();
      }
      return payload;
    } catch {
      throw new InvalidAccessTokenException();
    }
  }

  async validateRefreshToken(rawRefreshToken: string): Promise<UserSession> {
    const session = await this.sessions.findByRefreshTokenHash(this.hashRefreshToken(rawRefreshToken));
    const timestamp = nowMs();

    if (!session) {
      throw new InvalidRefreshTokenException();
    }
    if (session.isRevoked()) {
      throw new InvalidRefreshTokenException();
    }
    if (!session.isRefreshActive(timestamp)) {
      throw new ExpiredRefreshTokenException();
    }

    return session;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessions.revokeById(sessionId, nowMs());
  }

  private async signTokenPair(
    session: UserSession,
    user: User,
    refreshTokenRaw: string,
    timestamp: number,
  ): Promise<IssuedTokenPair> {
    const accessExpiresAt = timestamp + this.getAccessTtlMs();
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        role: user.role,
        sid: session.id,
        type: 'access',
      } satisfies JwtAccessPayload,
      {
        expiresIn: this.configService.get<number>('auth.jwtAccessTtlSeconds', 900),
        issuer: this.configService.get<string>('auth.jwtIssuer', 'venteapp-api'),
      },
    );

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      accessExpiresAt,
      refreshExpiresAt: timestamp + this.getRefreshTtlMs(),
      tokenType: 'Bearer',
    };
  }

  private getAccessTtlMs(): number {
    return this.configService.get<number>('auth.jwtAccessTtlSeconds', 900) * 1000;
  }

  private getRefreshTtlMs(): number {
    return msFromDays(this.configService.get<number>('auth.jwtRefreshTtlDays', 30));
  }
}
