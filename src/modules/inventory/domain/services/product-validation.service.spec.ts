import { ProductValidationService } from './product-validation.service';
import {
  InvalidProductNameException,
  InvalidProductPriceException,
  NegativeStockException,
  StockReasonRequiredException,
} from '../../exceptions/inventory.exceptions';

describe('ProductValidationService', () => {
  const service = new ProductValidationService();

  describe('validateName (RG-INV-01)', () => {
    it('accepte un nom valide', () => {
      expect(() => service.validateName('Riz 25kg')).not.toThrow();
    });

    it('rejette un nom trop court', () => {
      expect(() => service.validateName('A')).toThrow(InvalidProductNameException);
    });
  });

  describe('validatePrices (RG-INV-02/03)', () => {
    it('accepte prix vente seul', () => {
      expect(() => service.validatePrices({ priceSell: 1500 })).not.toThrow();
    });

    it('rejette prix vente nul', () => {
      expect(() => service.validatePrices({ priceSell: 0 })).toThrow(InvalidProductPriceException);
    });

    it('rejette prix achat >= prix vente', () => {
      expect(() =>
        service.validatePrices({ priceSell: 1000, priceBuy: 1200 }),
      ).toThrow(InvalidProductPriceException);
    });
  });

  describe('resolveAlertThreshold (RG-INV-06)', () => {
    it('utilise 5 par défaut', () => {
      expect(service.resolveAlertThreshold(null)).toBe(5);
    });

    it('conserve le seuil explicite', () => {
      expect(service.resolveAlertThreshold(10)).toBe(10);
    });
  });

  describe('validateStockAdjustment (RG-INV-10/11)', () => {
    it('exige un motif pour loss', () => {
      expect(() =>
        service.validateStockAdjustment('loss', 10, -2),
      ).toThrow(StockReasonRequiredException);
    });

    it('bloque le stock négatif', () => {
      expect(() =>
        service.validateStockAdjustment('restock', 3, -5, 'erreur inventaire'),
      ).toThrow(NegativeStockException);
    });

    it('calcule le stock après ajustement', () => {
      const result = service.validateStockAdjustment('restock', 10, 5);
      expect(result).toEqual({ quantityBefore: 10, quantityAfter: 15 });
    });
  });
});
