import { Injectable } from '@nestjs/common';
import { msFromMinutes, nowMs } from '../../../../shared/utils/time.util';
import { User } from '../../../users/domain/entities/user.entity';
import { ShopSettings } from '../../../shops/domain/entities/shop.entity';
import { AuthSession } from '../entities/auth-session.entity';

@Injectable()
export class SessionFactoryService {
  buildInsertPayload(user: User, settings: ShopSettings): Record<string, unknown> {
    const timestamp = nowMs();
    const expiresAt = timestamp + msFromMinutes(settings.autoLockMinutes);
    return {
      user_id: user.id,
      shop_id: user.shopId,
      pin_verified_at: timestamp,
      expires_at: expiresAt,
      last_activity_at: timestamp,
      created_at: timestamp,
    };
  }

  buildLoginSuccessPayload(session: AuthSession, user: User, settings: ShopSettings, shopName: string, shopId: number) {
    return {
      sessionToken: session.id,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        shopId: user.shopId,
        biometricEnabled: user.biometricEnabled,
        lastLoginAt: user.lastLoginAt,
      },
      shop: { id: shopId, name: shopName },
      autoLockMinutes: settings.autoLockMinutes,
      expiresAt: session.expiresAt,
    };
  }
}
