import { Injectable, NotFoundException } from '@nestjs/common';
import { AppCacheService } from '../../../../core/cache/app-cache.service';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { GetLockScreenQuery } from '../queries/get-lock-screen.query';

@Injectable()
export class GetLockScreenUseCase {
  private readonly cacheTtlMs = 60_000;

  constructor(
    private readonly shops: ShopRepository,
    private readonly settings: SettingsRepository,
    private readonly users: UserRepository,
    private readonly cache: AppCacheService,
  ) {}

  async execute(query: GetLockScreenQuery) {
    const cacheKey = `lock-screen:${query.shopId}`;
    const cached = this.cache.get<{
      shopId: number;
      shopName: string;
      shopLogoPath: string | null;
      users: Awaited<ReturnType<UserRepository['findActiveSummariesByShop']>>;
    }>(cacheKey);
    if (cached) return cached;

    const shop = await this.shops.findShopById(query.shopId);
    if (!shop) throw new NotFoundException(`Boutique ${query.shopId} introuvable.`);

    const settings = (await this.settings.findByShopId(query.shopId)) ?? this.settings.getDefault(query.shopId);
    const users = await this.users.findActiveSummariesByShop(query.shopId);

    const response = {
      shopId: shop.id,
      shopName: settings.shopName ?? shop.name,
      shopLogoPath: settings.shopLogoPath,
      users,
    };

    this.cache.set(cacheKey, response, this.cacheTtlMs);
    return response;
  }
}
