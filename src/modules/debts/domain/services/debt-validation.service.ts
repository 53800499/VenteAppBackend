import { Injectable } from '@nestjs/common';
import { DebtRepaymentMethod } from '../repositories/debt.repository';
import {
  DebtForgiveReasonTooShortException,
  DebtInvalidAmountException,
  DebtMomoReferenceRequiredException,
  DebtNotOpenException,
} from '../../exceptions/debts.exceptions';

const CRITICAL_DEBT_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FORGIVE_REASON_MIN_LENGTH = 10;

@Injectable()
export class DebtValidationService {
  assertDebtRepaymentAmount(amount: number, amountRemaining: number): void {
    if (amount <= 0) {
      throw new DebtInvalidAmountException('Le montant du remboursement doit être supérieur à 0 FCFA.');
    }
    if (amount > amountRemaining) {
      throw new DebtInvalidAmountException(
        `Le montant ne peut pas dépasser le solde restant (${amountRemaining} FCFA).`,
      );
    }
  }

  assertDebtIsRepayable(status: string): void {
    if (!['open', 'partial'].includes(status)) {
      throw new DebtNotOpenException();
    }
  }

  assertMomoReference(method: DebtRepaymentMethod, reference?: string | null): void {
    if ((method === 'mtn_momo' || method === 'moov_money') && (!reference || reference.trim().length < 8)) {
      throw new DebtMomoReferenceRequiredException();
    }
  }

  computeChangeGiven(method: DebtRepaymentMethod, amount: number, amountTendered?: number): number {
    if (method !== 'cash' || amountTendered == null) return 0;
    if (amountTendered < amount) {
      throw new DebtInvalidAmountException('Le montant remis en espèces est insuffisant.');
    }
    return amountTendered - amount;
  }

  resolveDebtStatusAfterPayment(amountRemaining: number): 'partial' | 'paid' {
    return amountRemaining === 0 ? 'paid' : 'partial';
  }

  assertForgiveReason(reason: string): void {
    if (!reason || reason.trim().length < FORGIVE_REASON_MIN_LENGTH) {
      throw new DebtForgiveReasonTooShortException(FORGIVE_REASON_MIN_LENGTH);
    }
  }

  isCriticalDebt(createdAt: number, amountPaid: number, now: number): boolean {
    return amountPaid === 0 && now - createdAt >= CRITICAL_DEBT_DAYS_MS;
  }

  computeDaysWithoutPayment(
    createdAt: number,
    amountPaid: number,
    lastPaymentAt: number | null,
    now: number,
  ): number {
    if (amountPaid === 0) {
      return Math.floor((now - createdAt) / (24 * 60 * 60 * 1000));
    }
    if (lastPaymentAt == null) return 0;
    return Math.floor((now - lastPaymentAt) / (24 * 60 * 60 * 1000));
  }
}
