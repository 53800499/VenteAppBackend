import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../../../users/domain/entities/user.entity';
import { UserRepository } from '../../../users/domain/repositories/user.repository';

@Injectable()
export class UserResolverService {
  constructor(private readonly users: UserRepository) {}

  async resolve(shopId: number, userId?: number): Promise<User> {
    if (userId) {
      const user = await this.users.findByIdAndShop(userId, shopId);
      if (!user) {
        throw new NotFoundException(`Utilisateur ${userId} introuvable dans cette boutique.`);
      }
      return user;
    }

    const user = await this.users.findFirstActiveByShop(shopId);
    if (!user) {
      throw new NotFoundException('Aucun utilisateur trouvé pour cette boutique.');
    }
    return user;
  }
}
