import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AUTH_EVENTS,
  AccountLockedEvent,
  DeviceRestoredEvent,
  DeviceRevokedEvent,
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

  @OnEvent(AUTH_EVENTS.DEVICE_RESTORED)
  onDeviceRestored(event: DeviceRestoredEvent): void {
    this.logger.log(`Session d'appareil restaurée silencieusement — deviceId=${event.deviceId}`);
  }

  @OnEvent(AUTH_EVENTS.DEVICE_REVOKED)
  onDeviceRevoked(event: DeviceRevokedEvent): void {
    this.logger.warn(`Session d'appareil révoquée à distance — sessionId=${event.sessionId} shop=${event.shopId}`);
  }
}
