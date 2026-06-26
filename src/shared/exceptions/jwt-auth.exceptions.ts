import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';
import { DomainException } from './domain.exception';

export class InvalidRefreshTokenException extends DomainException {
  constructor() {
    super(
      ErrorCode.AUTH_REFRESH_INVALID,
      'Refresh token invalide ou révoqué.',
      HttpStatus.UNAUTHORIZED,
      undefined,
      'Reconnectez-vous avec votre PIN.',
    );
  }
}

export class ExpiredRefreshTokenException extends DomainException {
  constructor() {
    super(
      ErrorCode.AUTH_REFRESH_EXPIRED,
      'Refresh token expiré.',
      HttpStatus.UNAUTHORIZED,
      undefined,
      'Utilisez POST /api/auth/pin/login pour obtenir de nouveaux jetons.',
    );
  }
}

export class InvalidAccessTokenException extends DomainException {
  constructor(message = 'Jeton d\'accès invalide ou expiré.') {
    super(ErrorCode.AUTH_SESSION_INVALID, message, HttpStatus.UNAUTHORIZED);
  }
}
