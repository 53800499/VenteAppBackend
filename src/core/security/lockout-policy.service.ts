import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nowMs } from '../../shared/utils/time.util';

export interface LockState {
  isLocked: boolean;
  lockedUntil: number | null;
  remainingSeconds: number;
  requiresEmergencyRecovery: boolean;
}

export interface FailedAttemptResult {
  update: Record<string, unknown>;
  remainingAttempts?: number;
  lockoutTriggered: boolean;
  lockoutCount?: number;
  lockedUntil?: number;
  requiresEmergencyRecovery?: boolean;
}

@Injectable()
export class LockoutPolicyService {
  constructor(private readonly configService: ConfigService) {}

  evaluate(user: {
    locked_until: number | null;
    lockout_count: number;
  }): LockState {
    const timestamp = nowMs();
    const lockedUntil = user.locked_until;
    const isLocked = lockedUntil !== null && lockedUntil > timestamp;
    const maxLockoutPeriods = this.configService.get<number>('auth.maxLockoutPeriods', 3);

    return {
      isLocked,
      lockedUntil: isLocked ? lockedUntil : null,
      remainingSeconds: isLocked ? Math.ceil((lockedUntil! - timestamp) / 1000) : 0,
      requiresEmergencyRecovery: !isLocked && user.lockout_count >= maxLockoutPeriods,
    };
  }

  onFailedAttempt(user: {
    failed_attempts: number;
    lockout_count: number;
    version: number;
  }): FailedAttemptResult {
    const maxFailed = this.configService.get<number>('auth.maxFailedAttempts', 5);
    const lockoutDuration = this.configService.get<number>('auth.lockoutDurationMs', 900_000);
    const maxLockoutPeriods = this.configService.get<number>('auth.maxLockoutPeriods', 3);
    const failedAttempts = user.failed_attempts + 1;
    const timestamp = nowMs();
    const update: Record<string, unknown> = {
      failed_attempts: failedAttempts,
      updated_at: timestamp,
      version: user.version + 1,
    };

    if (failedAttempts >= maxFailed) {
      const lockoutCount = user.lockout_count + 1;
      const lockedUntil = timestamp + lockoutDuration;
      update.failed_attempts = 0;
      update.locked_until = lockedUntil;
      update.lockout_count = lockoutCount;

      return {
        update,
        lockoutTriggered: true,
        lockoutCount,
        lockedUntil,
        requiresEmergencyRecovery: lockoutCount >= maxLockoutPeriods,
      };
    }

    return {
      update,
      lockoutTriggered: false,
      remainingAttempts: maxFailed - failedAttempts,
    };
  }
}
