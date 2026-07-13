import { BadRequestException, Injectable } from '@nestjs/common';
import { PurchaseOrderStatus, PurchasePaymentMethod, SupplierInvoiceStatus } from '../entities/purchase.entity';

@Injectable()
export class ProcurementValidationService {
  assertPositive(value: number, name: string): void {
    if (value <= 0) {
      throw new BadRequestException(`${name} doit être strictement supérieur à 0.`);
    }
  }

  assertNonNegative(value: number, name: string): void {
    if (value < 0) {
      throw new BadRequestException(`${name} doit être supérieur ou égal à 0.`);
    }
  }

  assertNotEmpty(value: string | null | undefined, name: string): string {
    if (!value || value.trim().length === 0) {
      throw new BadRequestException(`${name} ne doit pas être vide.`);
    }
    return value.trim();
  }

  validateStatusTransition(current: PurchaseOrderStatus, target: PurchaseOrderStatus): void {
    if (current === target) return;

    if (current === 'cancelled') {
      throw new BadRequestException(`Impossible de modifier une commande annulée.`);
    }
    if (current === 'received') {
      throw new BadRequestException(`Impossible de modifier une commande entièrement reçue.`);
    }

    const allowed: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      draft: ['validated', 'cancelled'],
      validated: ['sent', 'cancelled'],
      sent: ['partially_received', 'received', 'cancelled'],
      partially_received: ['partially_received', 'received', 'cancelled'],
      received: [],
      cancelled: [],
    };

    if (!allowed[current].includes(target)) {
      throw new BadRequestException(
        `Transition de statut non autorisée : de "${current}" à "${target}".`,
      );
    }
  }

  validatePaymentMethod(method: string): PurchasePaymentMethod {
    const valid: PurchasePaymentMethod[] = ['cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check'];
    if (!valid.includes(method as PurchasePaymentMethod)) {
      throw new BadRequestException(`Méthode de paiement invalide : "${method}".`);
    }
    return method as PurchasePaymentMethod;
  }

  validateInvoiceStatus(status: string): SupplierInvoiceStatus {
    const valid: SupplierInvoiceStatus[] = ['unpaid', 'partially_paid', 'paid'];
    if (!valid.includes(status as SupplierInvoiceStatus)) {
      throw new BadRequestException(`Statut de facture invalide : "${status}".`);
    }
    return status as SupplierInvoiceStatus;
  }
}
