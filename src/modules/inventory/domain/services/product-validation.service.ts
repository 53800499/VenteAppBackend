import { Injectable } from '@nestjs/common';
import {
  InvalidProductNameException,
  InvalidProductPriceException,
  InvalidStockQuantityException,
  NegativeStockException,
  StockReasonRequiredException,
} from '../../exceptions/inventory.exceptions';
import { StockMovementType } from '../entities/stock-movement.entity';

export interface ProductPriceInput {
  priceSell: number;
  priceBuy?: number | null;
}

export interface ProductCreateInput extends ProductPriceInput {
  name: string;
  initialQuantity: number;
  alertThreshold?: number | null;
}

@Injectable()
export class ProductValidationService {
  private static readonly DEFAULT_ALERT_THRESHOLD = 5;

  validateName(name: string): void {
    const trimmed = name?.trim() ?? '';
    if (trimmed.length < 2) {
      throw new InvalidProductNameException();
    }
  }

  validatePrices(input: ProductPriceInput): void {
    if (!Number.isInteger(input.priceSell) || input.priceSell <= 0) {
      throw new InvalidProductPriceException('Le prix de vente doit être un entier strictement positif (FCFA).');
    }

    if (input.priceBuy != null) {
      if (!Number.isInteger(input.priceBuy) || input.priceBuy <= 0) {
        throw new InvalidProductPriceException('Le prix d\'achat doit être un entier strictement positif (FCFA).');
      }
      if (input.priceBuy >= input.priceSell) {
        throw new InvalidProductPriceException('Le prix d\'achat doit être inférieur au prix de vente.', {
          priceBuy: input.priceBuy,
          priceSell: input.priceSell,
        });
      }
    }
  }

  validateInitialQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new InvalidStockQuantityException('La quantité initiale doit être un entier >= 0.');
    }
  }

  resolveAlertThreshold(threshold?: number | null, shopDefault = ProductValidationService.DEFAULT_ALERT_THRESHOLD): number {
    if (threshold == null) {
      return shopDefault;
    }
    if (!Number.isInteger(threshold) || threshold < 0) {
      throw new InvalidStockQuantityException('Le seuil d\'alerte doit être un entier >= 0.');
    }
    return threshold;
  }

  validateStockAdjustment(
    type: StockMovementType,
    currentStock: number,
    quantityChange: number,
    reason?: string | null,
  ): { quantityBefore: number; quantityAfter: number } {
    if (type === 'adjustment' || type === 'loss') {
      const trimmed = reason?.trim() ?? '';
      if (trimmed.length < 3) {
        throw new StockReasonRequiredException(type);
      }
    }

    const quantityAfter = currentStock + quantityChange;
    if (quantityAfter < 0) {
      throw new NegativeStockException(currentStock, quantityChange);
    }

    return { quantityBefore: currentStock, quantityAfter };
  }
}
