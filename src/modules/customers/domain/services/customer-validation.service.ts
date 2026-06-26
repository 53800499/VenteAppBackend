import { Injectable } from '@nestjs/common';
import {
  CustomerArchiveBlockedException,
  CustomerInvalidNameException,
  CustomerPhoneWarning,
} from '../../exceptions/customers.exceptions';

const NAME_MIN_LENGTH = 2;

@Injectable()
export class CustomerValidationService {
  assertName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length < NAME_MIN_LENGTH) {
      throw new CustomerInvalidNameException(NAME_MIN_LENGTH);
    }
    return trimmed;
  }

  phoneWarning(phone?: string | null): CustomerPhoneWarning | null {
    if (!phone || phone.trim().length < 8) {
      return {
        code: 'CUSTOMER_PHONE_MISSING',
        message: 'Le numéro de téléphone est fortement recommandé pour contacter le client (RG-CLI-02).',
      };
    }
    return null;
  }

  assertCanArchive(openDebtsCount: number): void {
    if (openDebtsCount > 0) {
      throw new CustomerArchiveBlockedException(
        'Impossible d\'archiver : ce client a des dettes ouvertes.',
      );
    }
  }

  buildWhatsappUrl(phone: string, message: string): string {
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('229') ? digits : `229${digits.replace(/^0+/, '')}`;
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  }
}
