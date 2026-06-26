import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { msFromMinutes, nowMs } from '../../../../shared/utils/time.util';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopOwnershipService } from '../../../shops/domain/services/shop-ownership.service';
import { ShopInactiveException } from '../../../shops/exceptions/shop.exceptions';
import { UserSessionRepository } from '../../domain/repositories/user-session.repository';

@Injectable()
export class SwitchShopUseCase {
  constructor(
    private readonly ownership: ShopOwnershipService,
    private readonly settings: SettingsRepository,
    private readonly sessions: UserSessionRepository,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, shopId: number) {
    if (auth.role !== UserRole.OWNER) {
      throw new NotFoundException('Boutique introuvable ou accès refusé.');
    }

    const shop = await this.ownership.assertOwnerAccess(auth.userId, auth.role, shopId);
    if (!shop.isActive) {
      throw new ShopInactiveException();
    }

    const shopSettings =
      (await this.settings.findByShopId(shopId)) ?? this.settings.getDefault(shopId);
    const timestamp = nowMs();
    const sessionExpiresAt = timestamp + msFromMinutes(shopSettings.autoLockMinutes);

    await this.sessions.updateActiveShop(auth.sessionId, shopId, timestamp, sessionExpiresAt);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SHOP_SWITCHED,
      module: AuditModule.SHOPS,
      entityId: shopId,
      entityTable: 'shops',
      oldValue: { shop_id: auth.shopId },
      newValue: { shop_id: shopId },
    });

    return {
      activeShopId: shopId,
      shop: {
        id: shop.id,
        name: shop.name,
      },
    };
  }
}
