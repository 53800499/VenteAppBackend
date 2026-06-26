import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { ShopOwnershipService } from '../../../shops/domain/services/shop-ownership.service';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserAccessPolicy {
  constructor(
    private readonly users: UserRepository,
    private readonly shopOwnership: ShopOwnershipService,
  ) {}

  /**
   * Utilisateur visible dans le contexte courant :
   * - même boutique active, ou
   * - patron propriétaire de la boutique d'affectation de l'utilisateur.
   */
  async assertAccessible(auth: AuthContext, userId: number): Promise<User> {
    const inActiveShop = await this.users.findByIdAndShop(userId, auth.shopId);
    if (inActiveShop) {
      return inActiveShop;
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    if (auth.role === UserRole.OWNER) {
      await this.shopOwnership.assertOwnerAccess(auth.userId, auth.role, user.shopId);
      return user;
    }

    throw new NotFoundException('Utilisateur introuvable dans cette boutique.');
  }
}
