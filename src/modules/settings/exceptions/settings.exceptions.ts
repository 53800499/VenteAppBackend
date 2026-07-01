import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../../shared/enums/error-code.enum';
import { DomainException } from '../../../shared/exceptions/domain.exception';

export class SettingsNotFoundException extends DomainException {
  constructor() {
    super(ErrorCode.NOT_FOUND, 'Paramètres boutique introuvables.', HttpStatus.NOT_FOUND);
  }
}

export class SettingsShopNameRequiredException extends DomainException {
  constructor() {
    super(
      ErrorCode.SETTINGS_SHOP_NAME_REQUIRED,
      'Le nom de la boutique est obligatoire (RG-PARAM-02).',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SettingsCurrencyImmutableException extends DomainException {
  constructor() {
    super(
      ErrorCode.SETTINGS_CURRENCY_IMMUTABLE,
      'La devise est fixée à FCFA en V1 (RG-PARAM-01).',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SettingsAutoLockOutOfRangeException extends DomainException {
  constructor(min: number, max: number) {
    super(
      ErrorCode.SETTINGS_AUTO_LOCK_OUT_OF_RANGE,
      `Le délai de verrouillage doit être entre ${min} et ${max} minutes.`,
      HttpStatus.BAD_REQUEST,
      { min, max },
    );
  }
}

export class SettingsReceiptFooterTooLongException extends DomainException {
  constructor(maxLength: number) {
    super(
      ErrorCode.SETTINGS_RECEIPT_FOOTER_TOO_LONG,
      `Le pied de page reçu ne peut pas dépasser ${maxLength} caractères.`,
      HttpStatus.BAD_REQUEST,
      { maxLength },
    );
  }
}

export class SettingsLanguageUnsupportedException extends DomainException {
  constructor(supported: string[]) {
    super(
      ErrorCode.SETTINGS_LANGUAGE_UNSUPPORTED,
      `Langue non supportée. Valeurs acceptées : ${supported.join(', ')}.`,
      HttpStatus.BAD_REQUEST,
      { supported },
    );
  }
}

export class SettingsInvalidAlertThresholdException extends DomainException {
  constructor() {
    super(
      ErrorCode.SETTINGS_INVALID_ALERT_THRESHOLD,
      'Le seuil d\'alerte stock doit être un entier positif ou zéro.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
