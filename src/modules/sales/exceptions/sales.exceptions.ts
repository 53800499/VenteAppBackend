import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../../shared/enums/error-code.enum';
import { DomainException } from '../../../shared/exceptions/domain.exception';

export class SaleNotFoundException extends DomainException {
  constructor(saleId: number) {
    super(
      ErrorCode.SALE_NOT_FOUND,
      'Vente introuvable.',
      HttpStatus.NOT_FOUND,
      { saleId },
    );
  }
}

export class SaleAlreadyCancelledException extends DomainException {
  constructor(saleId: number) {
    super(
      ErrorCode.SALE_ALREADY_CANCELLED,
      'Cette vente est déjà annulée.',
      HttpStatus.CONFLICT,
      { saleId },
    );
  }
}

export class SaleCancelWindowExpiredException extends DomainException {
  constructor() {
    super(
      ErrorCode.SALE_CANCEL_WINDOW_EXPIRED,
      'Une vente ne peut être annulée que dans les 24 heures suivant sa création.',
      HttpStatus.FORBIDDEN,
      undefined,
      'Seul un avoir peut être envisagé pour les ventes plus anciennes.',
    );
  }
}

export class SaleCancelDebtPartialException extends DomainException {
  constructor() {
    super(
      ErrorCode.SALE_CANCEL_DEBT_PARTIAL,
      'Impossible d\'annuler : la dette a déjà été partiellement remboursée.',
      HttpStatus.FORBIDDEN,
      undefined,
      'Créez un avoir plutôt qu\'une annulation.',
    );
  }
}

export class SaleInsufficientStockException extends DomainException {
  constructor(productName: string, available: number) {
    super(
      ErrorCode.SALE_INSUFFICIENT_STOCK,
      `Stock insuffisant pour « ${productName} » (${available} restant(s)).`,
      HttpStatus.BAD_REQUEST,
      { productName, available },
    );
  }
}

export class SaleCustomerRequiredException extends DomainException {
  constructor() {
    super(
      ErrorCode.SALE_CUSTOMER_REQUIRED,
      'Un client est obligatoire pour une vente à crédit.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SaleInvalidPaymentException extends DomainException {
  constructor(message: string) {
    super(
      ErrorCode.SALE_INVALID_PAYMENT,
      message,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SaleEmptyCartException extends DomainException {
  constructor() {
    super(
      ErrorCode.SALE_EMPTY_CART,
      'Le panier doit contenir au moins un produit.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SaleQuickCreditDeniedException extends DomainException {
  constructor() {
    super(
      ErrorCode.SALE_QUICK_CREDIT_DENIED,
      'Le mode rapide n\'est pas disponible pour les ventes à crédit.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SaleOwnerOnlyCancelException extends DomainException {
  constructor() {
    super(
      ErrorCode.SALE_OWNER_ONLY_CANCEL,
      'Seul le patron peut annuler une vente.',
      HttpStatus.FORBIDDEN,
    );
  }
}
