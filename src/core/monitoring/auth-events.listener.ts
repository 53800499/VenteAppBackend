import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AUTH_EVENTS,
  AccountLockedEvent,
  EmergencyUnlockEvent,
  PinLoginFailedEvent,
  PinLoginSucceededEvent,
  SetupCompletedEvent,
} from '../events/auth.events';

@Injectable()
export class AuthEventsListener {
  private readonly logger = new Logger('AuthEvents');

  @OnEvent(AUTH_EVENTS.PIN_LOGIN_SUCCEEDED)
  onLoginSucceeded(event: PinLoginSucceededEvent): void {
    this.logger.log(`Connexion PIN réussie — user=${event.userId} shop=${event.shopId}`);
  }

  @OnEvent(AUTH_EVENTS.PIN_LOGIN_FAILED)
  onLoginFailed(event: PinLoginFailedEvent): void {
    this.logger.warn(
      `Échec PIN — user=${event.userId} restant=${event.remainingAttempts}`,
    );
  }

  @OnEvent(AUTH_EVENTS.ACCOUNT_LOCKED)
  onAccountLocked(event: AccountLockedEvent): void {
    this.logger.warn(
      `Compte verrouillé — user=${event.userId} jusqu'à=${event.lockedUntil}`,
    );
  }

  @OnEvent(AUTH_EVENTS.EMERGENCY_UNLOCK)
  onEmergencyUnlock(event: EmergencyUnlockEvent): void {
    this.logger.warn(`Déblocage d'urgence — user=${event.userId} shop=${event.shopId}`);
  }

  @OnEvent(AUTH_EVENTS.SETUP_COMPLETED)
  onSetupCompleted(event: SetupCompletedEvent): void {
    this.logger.log(`Installation terminée — user=${event.userId} shop=${event.shopId}`);
  }
}
