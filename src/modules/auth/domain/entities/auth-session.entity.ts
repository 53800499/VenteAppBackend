export class AuthSession {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly shopId: number,
    public readonly pinVerifiedAt: number,
    public readonly expiresAt: number,
    public readonly lastActivityAt: number,
    public readonly createdAt: number,
  ) {}
}
