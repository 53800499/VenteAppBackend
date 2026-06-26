const BENIN_COUNTRY = '229';
const NATIONAL_PREFIX = '01';
const NATIONAL_LENGTH = 10;

const MIN_E164_DIGITS = 10;
const MAX_E164_DIGITS = 15;

function assertE164Digits(digits: string): void {
  if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) {
    throw new Error('Numéro de téléphone invalide.');
  }
}

function normalizeBeninLocalDigits(digits: string): string {
  if (digits.length === NATIONAL_LENGTH && digits.startsWith(NATIONAL_PREFIX)) {
    return `${BENIN_COUNTRY}${digits}`;
  }
  if (digits.length === 8) {
    return `${BENIN_COUNTRY}${NATIONAL_PREFIX}${digits}`;
  }
  if (digits.startsWith(BENIN_COUNTRY)) {
    const national = digits.slice(BENIN_COUNTRY.length);
    if (national.length === NATIONAL_LENGTH && national.startsWith(NATIONAL_PREFIX)) {
      return `${BENIN_COUNTRY}${national}`;
    }
    if (national.length === 8) {
      return `${BENIN_COUNTRY}${NATIONAL_PREFIX}${national}`;
    }
  }
  throw new Error('Numéro de téléphone invalide.');
}

/** Normalise vers le format WhatsApp (chiffres E.164, sans +). */
export function normalizePhoneToWhatsApp(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('Numéro de téléphone invalide.');
  }

  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    assertE164Digits(digits);
    return digits;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) {
    throw new Error('Numéro de téléphone invalide.');
  }

  if (digits.length >= 11 && digits.length <= MAX_E164_DIGITS) {
    assertE164Digits(digits);
    return digits;
  }

  return normalizeBeninLocalDigits(digits);
}

/** Format affichage E.164 (+XXXXXXXX). */
export function formatPhoneE164(whatsappDigits: string): string {
  return `+${whatsappDigits}`;
}

/** Masque un numéro pour l'UI. */
export function maskPhone(whatsappDigits: string): string {
  if (whatsappDigits.length < 8) return '***';
  const tail = whatsappDigits.slice(-2);
  if (
    whatsappDigits.startsWith(`${BENIN_COUNTRY}${NATIONAL_PREFIX}`) &&
    whatsappDigits.length >= 13
  ) {
    return `+${BENIN_COUNTRY} ${NATIONAL_PREFIX} ** ** ${tail}`;
  }
  const country = whatsappDigits.slice(0, Math.min(3, whatsappDigits.length - 4));
  return `+${country} ** ** ${tail}`;
}
