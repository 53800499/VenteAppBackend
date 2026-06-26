import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '../entities/sale.entity';
import {
  SaleCancelWindowExpiredException,
  SaleCustomerRequiredException,
  SaleEmptyCartException,
  SaleInsufficientStockException,
  SaleInvalidPaymentException,
  SaleQuickCreditDeniedException,
} from '../../exceptions/sales.exceptions';

export interface SaleLineDraft {
  productId: number;
  quantity: number;
  unitPrice: number;
  lineDiscountAmount: number;
}

export interface PaymentDraft {
  method: PaymentMethod;
  amountCash: number;
  amountMomo: number;
  amountCredit: number;
}

export type PaymentInput = {
  method: PaymentMethod;
  amountCash?: number;
  amountMomo?: number;
  amountCredit?: number;
};

export interface ComputedSaleTotals {
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountCash: number;
  amountMomo: number;
  amountCredit: number;
}

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SaleValidationService {
  assertStandardCart(lines: SaleLineDraft[]): void {
    if (lines.length === 0) {
      throw new SaleEmptyCartException();
    }
    for (const line of lines) {
      if (line.quantity <= 0) {
        throw new SaleInvalidPaymentException('La quantité de chaque produit doit être supérieure à 0.');
      }
      if (line.unitPrice <= 0) {
        throw new SaleInvalidPaymentException('Le prix unitaire doit être supérieur à 0.');
      }
      if (line.lineDiscountAmount < 0) {
        throw new SaleInvalidPaymentException('La remise ligne ne peut pas être négative.');
      }
    }
  }

  computeLineTotal(line: SaleLineDraft): number {
    const gross = Math.round(line.quantity * line.unitPrice);
    return Math.max(0, gross - line.lineDiscountAmount);
  }

  computeTotals(
    lines: SaleLineDraft[],
    globalDiscountAmount: number,
    payment: PaymentDraft,
  ): ComputedSaleTotals {
    const subtotal = lines.reduce((sum, line) => sum + this.computeLineTotal(line), 0);
    const discountAmount = Math.max(0, globalDiscountAmount);
    if (discountAmount > subtotal) {
      throw new SaleInvalidPaymentException('La remise ne peut pas dépasser le sous-total.');
    }
    const totalAmount = subtotal - discountAmount;
    const resolved = this.resolvePayment(totalAmount, payment);
    return { subtotal, discountAmount, ...resolved };
  }

  computeQuickTotals(totalAmount: number, payment: PaymentDraft): ComputedSaleTotals {
    if (totalAmount <= 0) {
      throw new SaleInvalidPaymentException('Le montant doit être supérieur à 0 FCFA.');
    }
    if (payment.amountCredit > 0) {
      throw new SaleQuickCreditDeniedException();
    }
    const resolved = this.resolvePayment(totalAmount, { ...payment, amountCredit: 0 });
    return { subtotal: totalAmount, discountAmount: 0, ...resolved };
  }

  assertCustomerForCredit(customerId: number | undefined, amountCredit: number): void {
    if (amountCredit > 0 && !customerId) {
      throw new SaleCustomerRequiredException();
    }
  }

  assertStockAvailable(productName: string, available: number, requested: number): void {
    if (requested > available) {
      throw new SaleInsufficientStockException(productName, available);
    }
  }

  assertCancelWindow(createdAt: number, now: number): void {
    if (now - createdAt > CANCEL_WINDOW_MS) {
      throw new SaleCancelWindowExpiredException();
    }
  }

  private resolvePayment(
    totalAmount: number,
    payment: PaymentDraft,
  ): Omit<ComputedSaleTotals, 'subtotal' | 'discountAmount'> {
    const amountCash = Math.max(0, payment.amountCash);
    const amountMomo = Math.max(0, payment.amountMomo);
    const amountCredit = Math.max(0, payment.amountCredit);
    const amountPaid = amountCash + amountMomo;

    if (amountPaid + amountCredit !== totalAmount) {
      throw new SaleInvalidPaymentException(
        'La somme encaissée (espèces + Mobile Money) + crédit doit être égale au total.',
      );
    }

    if (payment.method === 'credit' && amountCredit !== totalAmount) {
      throw new SaleInvalidPaymentException('Paiement crédit : le montant crédit doit couvrir le total.');
    }

    if (payment.method !== 'credit' && payment.method !== 'mixed' && amountCredit > 0) {
      throw new SaleInvalidPaymentException('Crédit non autorisé avec ce mode de paiement.');
    }

    return {
      totalAmount,
      amountPaid,
      amountCash,
      amountMomo,
      amountCredit,
    };
  }
}
