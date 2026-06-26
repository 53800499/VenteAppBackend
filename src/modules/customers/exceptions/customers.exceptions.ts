import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../../shared/enums/error-code.enum';
import { DomainException } from '../../../shared/exceptions/domain.exception';

export interface CustomerPhoneWarning {
  code: string;
  message: string;
}

export class CustomerNotFoundException extends DomainException {
  constructor(customerId: number) {
    super(ErrorCode.CUSTOMER_NOT_FOUND, 'Client introuvable.', HttpStatus.NOT_FOUND, { customerId });
  }
}

export class CustomerInvalidNameException extends DomainException {
  constructor(minLength: number) {
    super(
      ErrorCode.CUSTOMER_INVALID_NAME,
      `Le nom du client doit contenir au moins ${minLength} caractères.`,
      HttpStatus.BAD_REQUEST,
      { minLength },
    );
  }
}

export class CustomerAlreadyArchivedException extends DomainException {
  constructor(customerId: number) {
    super(
      ErrorCode.CUSTOMER_ALREADY_ARCHIVED,
      'Ce client est déjà archivé.',
      HttpStatus.CONFLICT,
      { customerId },
    );
  }
}

export class CustomerArchiveBlockedException extends DomainException {
  constructor(message: string) {
    super(ErrorCode.CUSTOMER_ARCHIVE_BLOCKED, message, HttpStatus.CONFLICT);
  }
}

export class CustomerDebtReminderNoPhoneException extends DomainException {
  constructor() {
    super(
      ErrorCode.CUSTOMER_DEBT_REMINDER_NO_PHONE,
      'Impossible d\'envoyer un rappel : aucun numéro de téléphone renseigné.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
