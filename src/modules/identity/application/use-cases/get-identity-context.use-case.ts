import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { IdentityRepository } from '../../domain/repositories/identity.repository';

@Injectable()
export class GetIdentityContextUseCase {
  constructor(private readonly identity: IdentityRepository) {}

  async execute(auth: AuthContext) {
    const context = await this.identity.findIdentityContext(auth.userId, auth.shopId);
    if (!context) {
      throw new NotFoundException('Identité introuvable pour cette session.');
    }
    return context;
  }
}
