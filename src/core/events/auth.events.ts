export const AUTH_EVENTS = {
  PIN_LOGIN_SUCCEEDED: 'auth.pin_login_succeeded',
  PIN_LOGIN_FAILED: 'auth.pin_login_failed',
  ACCOUNT_LOCKED: 'auth.account_locked',
  EMERGENCY_UNLOCK: 'auth.emergency_unlock',
  SETUP_COMPLETED: 'auth.setup_completed',
} as const;

export class PinLoginSucceededEvent {
  constructor(
    public readonly userId: number,
    public readonly shopId: number,
  ) {}
}

export class PinLoginFailedEvent {
  constructor(
    public readonly userId: number,
    public readonly remainingAttempts: number,
  ) {}
}

export class AccountLockedEvent {
  constructor(
    public readonly userId: number,
    public readonly lockedUntil: number,
    public readonly lockoutCount: number,
  ) {}
}

export class EmergencyUnlockEvent {
  constructor(
    public readonly userId: number,
    public readonly shopId: number,
  ) {}
}

export class SetupCompletedEvent {
  constructor(
    public readonly userId: number,
    public readonly shopId: number,
  ) {}
}
