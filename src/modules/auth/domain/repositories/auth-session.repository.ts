import { AuthSession } from '../entities/auth-session.entity';

export abstract class AuthSessionRepository {
  /** Bootstrap session par token (avant contexte tenant) */
  abstract findById(id: string): Promise<AuthSession | null>;
  abstract findByIdAndShop(id: string, shopId: number): Promise<AuthSession | null>;
  abstract create(data: Record<string, unknown>): Promise<AuthSession>;
  abstract touchInShop(
    id: string,
    shopId: number,
    lastActivityAt: number,
    expiresAt: number,
  ): Promise<void>;
}
