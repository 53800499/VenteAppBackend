import { UserSession } from '../entities/user-session.entity';

export interface CreateUserSessionData {
  user_id: number;
  shop_id: number;
  device_id: string;
  device_label?: string | null;
  refresh_token_hash: string;
  pin_verified_at: number;
  last_seen_at: number;
  session_expires_at: number;
  refresh_expires_at: number;
  created_at: number;
}

export abstract class UserSessionRepository {
  abstract findById(id: string): Promise<UserSession | null>;
  abstract findByIdAndShop(id: string, shopId: number): Promise<UserSession | null>;
  abstract findByRefreshTokenHash(hash: string): Promise<UserSession | null>;
  abstract create(data: CreateUserSessionData): Promise<UserSession>;
  abstract updateRefreshToken(
    id: string,
    refreshTokenHash: string,
    refreshExpiresAt: number,
    sessionExpiresAt: number,
    lastSeenAt: number,
  ): Promise<void>;
  abstract updateActiveShop(
    id: string,
    shopId: number,
    lastSeenAt: number,
    sessionExpiresAt: number,
  ): Promise<void>;
  abstract touchById(id: string, lastSeenAt: number, sessionExpiresAt: number): Promise<void>;
  abstract revokeById(id: string, revokedAt: number): Promise<void>;
  abstract revokeActiveByDevice(
    userId: number,
    shopId: number,
    deviceId: string,
    revokedAt: number,
  ): Promise<void>;
  abstract listActiveByUser(userId: number): Promise<UserSession[]>;
  abstract listActiveByShop(shopId: number): Promise<UserSession[]>;
}
