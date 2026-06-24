import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PinHasherService } from '../../../../core/security/pin-hasher.service';
import { nowMs } from '../../../../shared/utils/time.util';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { AuthSessionRepository } from '../../domain/repositories/auth-session.repository';
import { Pin } from '../../domain/value-objects/pin.vo';
import { EnableBiometricCommand } from '../commands/auth.commands';

@Injectable()
export class EnableBiometricUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly pinHasher: PinHasherService,
  ) {}

  async execute(command: EnableBiometricCommand) {
    const session = await this.sessions.findById(command.sessionToken);
    if (!session || session.userId !== command.userId || session.expiresAt <= nowMs()) {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }

    const user = await this.users.findByIdAndShop(command.userId, session.shopId);
    if (!user) throw new UnauthorizedException('Utilisateur introuvable.');

    const pin = Pin.create(command.pin);
    const pinValid = await this.pinHasher.compare(pin.value, user.pinHash);
    if (!pinValid) throw new UnauthorizedException('PIN incorrect.');

    const timestamp = nowMs();
    await this.users.updateInShop(user.id, session.shopId, {
      biometric_enabled: true,
      updated_at: timestamp,
      version: user.version + 1,
    });

    return { biometricEnabled: true };
  }
}
