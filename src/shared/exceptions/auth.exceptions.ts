import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';
import { DomainException } from './domain.exception';

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

export class WhatsappSendFailedException extends DomainException {
  constructor(hint?: string) {
    super(
      ErrorCode.AUTH_WHATSAPP_SEND_FAILED,
      'Envoi WhatsApp impossible. Réessayez plus tard.',
      HttpStatus.SERVICE_UNAVAILABLE,
      undefined,
      hint ??
        'Vérifiez WHATSAPP_ACCESS_TOKEN et WHATSAPP_PHONE_NUMBER_ID (token Meta valide, non expiré).',
    );
  }
}
