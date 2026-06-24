import { Injectable } from '@nestjs/common';
import { PermissionService } from '../../../../core/security/permission.service';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { User } from '../../../users/domain/entities/user.entity';
import { ShopSettings } from '../../../shops/domain/entities/shop.entity';

interface LoginPresentationInput {
  session: AuthSession;
  user: User;
  settings: ShopSettings;
  shopId: number;
  shopName: string;
}

@Injectable()
export class AuthPresenter {
  constructor(private readonly permissionService: PermissionService) {}

  async presentLoginSuccess(input: LoginPresentationInput) {
    const permissions = await this.permissionService.resolveForUser({
      userId: input.user.id,
      role: input.user.role,
      shopId: input.user.shopId,
    });
    const roleLabel = await this.permissionService.getRoleLabel(input.user.role);

    return {
      sessionToken: input.session.id,
      user: {
        id: input.user.id,
        name: input.user.name,
        role: input.user.role,
        roleLabel,
        shopId: input.user.shopId,
        biometricEnabled: input.user.biometricEnabled,
        lastLoginAt: input.user.lastLoginAt,
        permissions,
      },
      shop: { id: input.shopId, name: input.shopName },
      autoLockMinutes: input.settings.autoLockMinutes,
      expiresAt: input.session.expiresAt,
    };
  }

  async presentEmergencyUnlock(input: LoginPresentationInput) {
    return {
      ...(await this.presentLoginSuccess(input)),
      message: 'Déblocage d\'urgence réussi.',
    };
  }
}
