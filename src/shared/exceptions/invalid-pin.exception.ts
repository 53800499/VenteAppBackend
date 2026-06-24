import { UnauthorizedException } from '@nestjs/common';

export class InvalidPinException extends UnauthorizedException {
  constructor(remainingAttempts: number) {
    super({
      message: `Code incorrect. ${remainingAttempts} tentatives restantes.`,
      remainingAttempts,
    });
  }
}
