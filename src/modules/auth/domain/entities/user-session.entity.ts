export class UserSession {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly shopId: number,
    public readonly deviceId: string,
    public readonly deviceLabel: string | null,
    public readonly refreshTokenHash: string,
    public readonly pinVerifiedAt: number,
    public readonly lastSeenAt: number,
    public readonly sessionExpiresAt: number,
    public readonly refreshExpiresAt: number,
    public readonly revokedAt: number | null,
    public readonly replacedById: string | null,
    public readonly createdAt: number,
  ) {}

  isRevoked(): boolean {
    return this.revokedAt != null;
  }

  isSessionActive(now: number): boolean {
    return !this.isRevoked() && this.sessionExpiresAt > now;
  }

  isRefreshActive(now: number): boolean {
    return !this.isRevoked() && this.refreshExpiresAt > now;
  }
}
