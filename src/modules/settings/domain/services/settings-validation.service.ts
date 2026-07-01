import { Injectable } from '@nestjs/common';
import {
  SettingsAutoLockOutOfRangeException,
  SettingsCurrencyImmutableException,
  SettingsInvalidAlertThresholdException,
  SettingsLanguageUnsupportedException,
  SettingsReceiptFooterTooLongException,
  SettingsShopNameRequiredException,
} from '../../exceptions/settings.exceptions';

const RECEIPT_FOOTER_MAX_LENGTH = 500;
const AUTO_LOCK_MIN = 1;
const AUTO_LOCK_MAX = 120;
const SUPPORTED_LANGUAGES = ['fr'] as const;

@Injectable()
export class SettingsValidationService {
  assertShopName(name: string | undefined): void {
    if (!name || !name.trim()) {
      throw new SettingsShopNameRequiredException();
    }
  }

  assertAutoLockMinutes(minutes: number): void {
    if (!Number.isInteger(minutes) || minutes < AUTO_LOCK_MIN || minutes > AUTO_LOCK_MAX) {
      throw new SettingsAutoLockOutOfRangeException(AUTO_LOCK_MIN, AUTO_LOCK_MAX);
    }
  }

  assertDefaultAlertThreshold(threshold: number): void {
    if (!Number.isInteger(threshold) || threshold < 0) {
      throw new SettingsInvalidAlertThresholdException();
    }
  }

  assertReceiptFooter(footer: string | null | undefined): void {
    if (footer != null && footer.length > RECEIPT_FOOTER_MAX_LENGTH) {
      throw new SettingsReceiptFooterTooLongException(RECEIPT_FOOTER_MAX_LENGTH);
    }
  }

  assertCurrencyImmutable(requested?: string): void {
    if (requested != null && requested !== 'FCFA') {
      throw new SettingsCurrencyImmutableException();
    }
  }

  assertLanguage(language: string | undefined): void {
    if (language != null && !SUPPORTED_LANGUAGES.includes(language as (typeof SUPPORTED_LANGUAGES)[number])) {
      throw new SettingsLanguageUnsupportedException([...SUPPORTED_LANGUAGES]);
    }
  }
}

export const BACKUP_REMINDER_AGE_MS = 7 * 24 * 60 * 60 * 1000;
