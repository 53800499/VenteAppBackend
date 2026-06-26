import { User, UserSummary } from '../entities/user.entity';

export abstract class UserRepository {
  abstract countAll(): Promise<number>;
  /** @deprecated Préférer findByIdAndShop — réservé au bootstrap session */
  abstract findById(id: number): Promise<User | null>;
  abstract findByIdAndShop(id: number, shopId: number): Promise<User | null>;
  abstract findFirstActiveByShop(shopId: number): Promise<User | null>;
  abstract findActiveSummariesByShop(shopId: number): Promise<UserSummary[]>;
  abstract findAllByShop(shopId: number): Promise<User[]>;
  abstract existsByNameInShop(shopId: number, name: string): Promise<boolean>;
  abstract existsByNameInShopExcluding(
    shopId: number,
    name: string,
    excludeUserId: number,
  ): Promise<boolean>;
  abstract countOwnersByShop(shopId: number): Promise<number>;
  abstract create(data: Record<string, unknown>): Promise<User>;
  abstract updateInShop(id: number, shopId: number, data: Record<string, unknown>): Promise<void>;
  abstract updateById(id: number, data: Record<string, unknown>): Promise<void>;
  abstract findActiveByPhone(phone: string): Promise<User[]>;
}
