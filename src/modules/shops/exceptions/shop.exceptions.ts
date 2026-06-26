import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../../shared/enums/error-code.enum';
import { DomainException } from '../../../shared/exceptions/domain.exception';

export class LastActiveShopException extends DomainException {
  constructor() {
    super(
      ErrorCode.SHOP_LAST_ACTIVE_PROTECTED,
      'Impossible de désactiver la dernière boutique active.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ShopInactiveException extends DomainException {
  constructor() {
    super(
      ErrorCode.SHOP_INACTIVE,
      'Cette boutique est désactivée.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ShopSwitchDeniedException extends DomainException {
  constructor() {
    super(
      ErrorCode.SHOP_SWITCH_DENIED,
      'Vous ne pouvez basculer que vers vos propres boutiques actives.',
      HttpStatus.FORBIDDEN,
    );
  }
}
