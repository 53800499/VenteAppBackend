import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { msFromMinutes, nowMs } from '../../../../shared/utils/time.util';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopOwnershipService } from '../../../shops/domain/services/shop-ownership.service';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { ShopInactiveException } from '../../../shops/exceptions/shop.exceptions';
import { UserSessionRepository } from '../../domain/repositories/user-session.repository';
import { PermissionService } from '../../../../core/security/permission.service';

@Injectable()
export class SwitchShopUseCase {
  constructor(
    private readonly ownership: ShopOwnershipService,
    private readonly shops: ShopRepository,
    private readonly settings: SettingsRepository,
    private readonly sessions: UserSessionRepository,
    private readonly logAudit: LogAuditUseCase,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(auth: AuthContext, shopId: number) {
    const userForShop = await this.ownership.resolveUserForShop(auth.userId, shopId);
    if (!userForShop) {
      throw new NotFoundException('Boutique introuvable ou accès non autorisé.');
    }

    const shop = await this.shops.findShopById(shopId);
    if (!shop || !shop.isActive) {
      throw new ShopInactiveException();
    }

    const shopSettings =
      (await this.settings.findByShopId(shopId)) ?? this.settings.getDefault(shopId);
    const timestamp = nowMs();
    const sessionExpiresAt = timestamp + msFromMinutes(Math.max(shopSettings.autoLockMinutes, 60));

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

    const permissions = await this.permissionService.resolveForUser({
      userId: userForShop.id,
      role: userForShop.role,
      shopId: shop.id,
    });

    return {
      activeShopId: shop.id,
      shop: {
        id: shop.id,
        name: shop.name,
        role: userForShop.role,
      },
      permissions,
      permissionsVersion: timestamp,
    };
  }
}
