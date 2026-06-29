import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../../shared/enums/error-code.enum';
import { DomainException } from '../../../shared/exceptions/domain.exception';

export class PaymentNotFoundException extends DomainException {
  constructor(paymentId: number) {
    super(ErrorCode.PAYMENT_NOT_FOUND, 'Paiement introuvable.', HttpStatus.NOT_FOUND, { paymentId });
  }
}
