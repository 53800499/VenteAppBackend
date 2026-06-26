import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PinHasherService } from '../../../../core/security/pin-hasher.service';
import { AUTH_EVENTS, EmergencyUnlockEvent } from '../../../../core/events/auth.events';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { AuthTokenService } from '../../domain/services/auth-token.service';
import { UserResolverService } from '../../domain/services/user-resolver.service';
import { EmergencyUnlockCommand } from '../commands/auth.commands';
import { AuthPresenter } from '../../presentation/presenters/auth.presenter';

@Injectable()
export class EmergencyUnlockUseCase {
  constructor(
    private readonly userResolver: UserResolverService,
    private readonly users: UserRepository,
    private readonly shops: ShopRepository,
    private readonly settings: SettingsRepository,
    private readonly authTokenService: AuthTokenService,
    private readonly pinHasher: PinHasherService,
    private readonly logAudit: LogAuditUseCase,
    private readonly presenter: AuthPresenter,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: EmergencyUnlockCommand) {
    const user = await this.userResolver.resolve(command.shopId, command.userId);

    if (!user.emergencyRecoveryHash) {
      throw new BadRequestException('Aucun fichier de récupération configuré.');
    }

    const tokenValid = await this.pinHasher.compare(command.recoveryToken, user.emergencyRecoveryHash);
    if (!tokenValid) {
      throw new UnauthorizedException('Fichier de récupération invalide.');
    }

    const settings = (await this.settings.findByShopId(command.shopId)) ?? this.settings.getDefault(command.shopId);
    const timestamp = nowMs();

    await this.users.updateInShop(user.id, command.shopId, {
      failed_attempts: 0,
      locked_until: null,
      lockout_count: 0,
      updated_at: timestamp,
      version: user.version + 1,
    });

    await this.logAudit.execute({
      shopId: user.shopId,
      userId: user.id,
      action: AuditAction.EMERGENCY_UNLOCK,
      module: AuditModule.SETTINGS,
      entityId: user.id,
      entityTable: 'users',
      oldValue: {
        failed_attempts: user.failedAttempts,
        locked_until: user.lockedUntil,
        lockout_count: user.lockoutCount,
      },
      newValue: { failed_attempts: 0, locked_until: null, lockout_count: 0 },
      reason: 'Déblocage via fichier de récupération d\'urgence',
    });

    const activeUser = { ...user, lastLoginAt: timestamp };
    const { session, tokens } = await this.authTokenService.bootstrapSession(activeUser, settings.shopId, settings, {
      deviceId: command.deviceId,
      deviceLabel: command.deviceLabel,
    });
    const shop = await this.shops.findShopById(command.shopId);

    this.events.emit(
      AUTH_EVENTS.EMERGENCY_UNLOCK,
      new EmergencyUnlockEvent(user.id, command.shopId),
    );

    return this.presenter.presentEmergencyUnlock({
      session,
      user: activeUser,
      settings,
      shopId: command.shopId,
      shopName: shop?.name ?? settings.shopName,
      tokens,
    });
  }
}
