import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../../shared/enums/error-code.enum';
import { DomainException } from '../../../shared/exceptions/domain.exception';

export class DebtNotFoundException extends DomainException {
  constructor(debtId: number) {
    super(ErrorCode.DEBT_NOT_FOUND, 'Dette introuvable.', HttpStatus.NOT_FOUND, { debtId });
  }
}

export class DebtNotOpenException extends DomainException {
  constructor() {
    super(
      ErrorCode.DEBT_NOT_OPEN,
      'Cette dette ne peut plus recevoir de remboursement.',
      HttpStatus.CONFLICT,
    );
  }
}

export class DebtInvalidAmountException extends DomainException {
  constructor(message: string) {
    super(ErrorCode.DEBT_INVALID_AMOUNT, message, HttpStatus.BAD_REQUEST);
  }
}

export class DebtForgiveDeniedException extends DomainException {
  constructor() {
    super(
      ErrorCode.DEBT_FORGIVE_DENIED,
      'Seul le patron peut pardonner une dette.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class DebtForgiveReasonTooShortException extends DomainException {
  constructor(minLength: number) {
    super(
      ErrorCode.DEBT_FORGIVE_REASON_TOO_SHORT,
      `Le motif du pardon doit contenir au moins ${minLength} caractères.`,
      HttpStatus.BAD_REQUEST,
      { minLength },
    );
  }
}

export class DebtAlreadyForgivenException extends DomainException {
  constructor(debtId: number) {
    super(
      ErrorCode.DEBT_ALREADY_FORGIVEN,
      'Cette dette est déjà pardonnée ou soldée.',
      HttpStatus.CONFLICT,
      { debtId },
    );
  }
}

export class PaymentNotFoundException extends DomainException {
  constructor(paymentId: number) {
    super(ErrorCode.PAYMENT_NOT_FOUND, 'Paiement introuvable.', HttpStatus.NOT_FOUND, { paymentId });
  }
}

export class PaymentMomoReferenceRequiredException extends DomainException {
  constructor() {
    super(
      ErrorCode.PAYMENT_MOMO_REFERENCE_REQUIRED,
      'Un numéro de téléphone ou une référence de transaction est requis pour Mobile Money.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
