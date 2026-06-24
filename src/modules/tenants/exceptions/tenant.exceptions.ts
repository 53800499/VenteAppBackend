import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../../shared/enums/error-code.enum';
import { DomainException } from '../../../shared/exceptions/domain.exception';

export class TenantContextRequiredException extends DomainException {
  constructor() {
    super(
      ErrorCode.TENANT_CONTEXT_REQUIRED,
      'Contexte boutique requis pour cette opération.',
      HttpStatus.FORBIDDEN,
      undefined,
      'Reconnectez-vous ou spécifiez la boutique active.',
    );
  }
}

export class TenantAccessDeniedException extends DomainException {
  constructor(shopId: number, resource?: string) {
    super(
      ErrorCode.TENANT_ACCESS_DENIED,
      'Accès refusé : ressource hors de votre boutique.',
      HttpStatus.FORBIDDEN,
      { shopId, resource },
      'Cette ressource appartient à une autre boutique.',
    );
  }
}
