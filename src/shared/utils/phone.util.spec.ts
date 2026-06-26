import { normalizePhoneToWhatsApp, maskPhone } from './phone.util';

describe('phone.util', () => {
  describe('normalizePhoneToWhatsApp', () => {
    it('accepte le format national béninois 01...', () => {
      expect(normalizePhoneToWhatsApp('01 97 00 00 00')).toBe('2290197000000');
    });

    it('convertit l\'ancien format 8 chiffres béninois', () => {
      expect(normalizePhoneToWhatsApp('97000000')).toBe('2290197000000');
    });

    it('accepte un numéro international', () => {
      expect(normalizePhoneToWhatsApp('+33612345678')).toBe('33612345678');
    });

    it('rejette un numéro invalide', () => {
      expect(() => normalizePhoneToWhatsApp('')).toThrow();
      expect(() => normalizePhoneToWhatsApp('123')).toThrow();
    });
  });

  describe('maskPhone', () => {
    it('masque un numéro béninois', () => {
      expect(maskPhone('2290197000056')).toBe('+229 01 ** ** 56');
    });
  });
});
