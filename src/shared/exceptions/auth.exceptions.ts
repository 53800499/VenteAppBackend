import { ForbiddenException } from '@nestjs/common';

export class AccountLockedException extends ForbiddenException {
  constructor(lockedUntil: number, remainingSeconds: number) {
    super({
      message: 'Application verrouillée. Réessayez plus tard.',
      lockedUntil,
      remainingSeconds,
    });
  }
}

export class EmergencyRecoveryRequiredException extends ForbiddenException {
  constructor() {
    super({
      message: 'Déblocage impossible par PIN. Utilisez le fichier de récupération d\'urgence.',
      requiresEmergencyRecovery: true,
    });
  }
}

export class MaxAttemptsLockoutException extends ForbiddenException {
  constructor(
    lockedUntil: number,
    remainingSeconds: number,
    lockoutCount: number,
    requiresEmergencyRecovery: boolean,
  ) {
    super({
      message: 'Trop de tentatives. Application verrouillée pendant 15 minutes.',
      lockedUntil,
      remainingSeconds,
      lockoutCount,
      requiresEmergencyRecovery,
    });
  }
}
