import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LockoutPolicyService } from '../../../../core/security/lockout-policy.service';
import { PinHasherService } from '../../../../core/security/pin-hasher.service';
import {
  AUTH_EVENTS,
  AccountLockedEvent,
  PinLoginFailedEvent,
  PinLoginSucceededEvent,
} from '../../../../core/events/auth.events';
import {
  AccountLockedException,
  EmergencyRecoveryRequiredException,
  MaxAttemptsLockoutException,
} from '../../../../shared/exceptions/auth.exceptions';
import { InvalidPinException } from '../../../../shared/exceptions/invalid-pin.exception';
import { nowMs } from '../../../../shared/utils/time.util';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { AuthSessionRepository } from '../../domain/repositories/auth-session.repository';
import { SessionFactoryService } from '../../domain/services/session-factory.service';
import { UserResolverService } from '../../domain/services/user-resolver.service';
import { Pin } from '../../domain/value-objects/pin.vo';
import { LoginPinCommand } from '../commands/auth.commands';
import { AuthPresenter } from '../../presentation/presenters/auth.presenter';

@Injectable()
export class LoginWithPinUseCase {
  constructor(
    private readonly userResolver: UserResolverService,
    private readonly users: UserRepository,
    private readonly shops: ShopRepository,
    private readonly settings: SettingsRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly pinHasher: PinHasherService,
    private readonly lockoutPolicy: LockoutPolicyService,
    private readonly sessionFactory: SessionFactoryService,
    private readonly presenter: AuthPresenter,
    private readonly configService: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: LoginPinCommand) {
    const pin = Pin.create(command.pin);
    const user = await this.userResolver.resolve(command.shopId, command.userId);
    const settings = (await this.settings.findByShopId(command.shopId)) ?? this.settings.getDefault(command.shopId);
    const lockState = this.lockoutPolicy.evaluate({
      locked_until: user.lockedUntil,
      lockout_count: user.lockoutCount,
    });

    if (lockState.isLocked) {
      throw new AccountLockedException(lockState.lockedUntil!, lockState.remainingSeconds);
    }

    if (lockState.requiresEmergencyRecovery) {
      throw new EmergencyRecoveryRequiredException();
    }

    const pinValid = await this.pinHasher.compare(pin.value, user.pinHash);
    if (!pinValid) {
      return this.handleFailedAttempt(user, command.shopId);
    }

    const loginAt = nowMs();
    await this.users.updateInShop(user.id, command.shopId, {
      failed_attempts: 0,
      locked_until: null,
      lockout_count: 0,
      last_login_at: loginAt,
      updated_at: loginAt,
      version: user.version + 1,
    });

    const session = await this.sessions.create(
      this.sessionFactory.buildInsertPayload(
        { ...user, lastLoginAt: loginAt } as typeof user,
        settings,
      ),
    );

    const shop = await this.shops.findShopById(command.shopId);
    this.events.emit(
      AUTH_EVENTS.PIN_LOGIN_SUCCEEDED,
      new PinLoginSucceededEvent(user.id, command.shopId),
    );

    return this.presenter.presentLoginSuccess({
      session,
      user: { ...user, lastLoginAt: loginAt },
      settings,
      shopId: command.shopId,
      shopName: shop?.name ?? settings.shopName,
    });
  }

  private async handleFailedAttempt(
    user: Awaited<ReturnType<UserResolverService['resolve']>>,
    shopId: number,
  ) {
    const result = this.lockoutPolicy.onFailedAttempt({
      failed_attempts: user.failedAttempts,
      lockout_count: user.lockoutCount,
      version: user.version,
    });

    await this.users.updateInShop(user.id, shopId, result.update);

    if (result.lockoutTriggered) {
      const lockoutDuration = this.configService.get<number>('auth.lockoutDurationMs', 900_000);
      this.events.emit(
        AUTH_EVENTS.ACCOUNT_LOCKED,
        new AccountLockedEvent(user.id, result.lockedUntil!, result.lockoutCount!),
      );
      throw new MaxAttemptsLockoutException(
        result.lockedUntil!,
        lockoutDuration / 1000,
        result.lockoutCount!,
        result.requiresEmergencyRecovery ?? false,
      );
    }

    this.events.emit(
      AUTH_EVENTS.PIN_LOGIN_FAILED,
      new PinLoginFailedEvent(user.id, result.remainingAttempts!),
    );
    throw new InvalidPinException(result.remainingAttempts!);
  }
}
