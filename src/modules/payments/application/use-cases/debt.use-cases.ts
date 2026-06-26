import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { Debt } from '../../domain/entities/debt.entity';
import { DebtRepository } from '../../domain/repositories/debt.repository';
import { PaymentReceiptService } from '../../domain/services/payment-receipt.service';
import { PaymentValidationService } from '../../domain/services/payment-validation.service';
import {
  DebtAlreadyForgivenException,
  DebtForgiveDeniedException,
  DebtNotFoundException,
} from '../../exceptions/payments.exceptions';

function toDebtResponse(debt: Debt, now = nowMs()) {
  return {
    id: debt.id,
    customerId: debt.customerId,
    customerName: debt.customerName,
    saleId: debt.saleId,
    originalAmount: debt.originalAmount,
    amountPaid: debt.amountPaid,
    amountRemaining: debt.amountRemaining,
    status: debt.status,
    dueAt: debt.dueAt,
    createdAt: debt.createdAt,
    updatedAt: debt.updatedAt,
    isCritical: debt.status === 'open' || debt.status === 'partial'
      ? debt.amountPaid === 0 && now - debt.createdAt >= 30 * 24 * 60 * 60 * 1000
      : false,
    payments: debt.payments.map((p) => ({
      id: p.id,
      paymentId: p.paymentId,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      createdAt: p.createdAt,
    })),
  };
}

@Injectable()
export class ListDebtsUseCase {
  constructor(private readonly debts: DebtRepository) {}

  async execute(
    auth: AuthContext,
    filters?: {
      status?: string;
      customerId?: number;
      criticalOnly?: boolean;
      limit?: number;
    },
  ) {
    const rows = await this.debts.listByShop(auth.shopId, {
      status: filters?.status as Debt['status'] | undefined,
      customerId: filters?.customerId,
      criticalOnly: filters?.criticalOnly,
      limit: filters?.limit ?? 50,
    });
    const now = nowMs();
    return rows.map((debt) => toDebtResponse(debt, now));
  }
}

@Injectable()
export class GetDebtUseCase {
  constructor(private readonly debts: DebtRepository) {}

  async execute(auth: AuthContext, debtId: number) {
    const debt = await this.debts.findByIdAndShop(debtId, auth.shopId, true);
    if (!debt) throw new DebtNotFoundException(debtId);
    return toDebtResponse(debt);
  }
}

@Injectable()
export class RecordDebtPaymentUseCase {
  constructor(
    private readonly debts: DebtRepository,
    private readonly validation: PaymentValidationService,
    private readonly receipts: PaymentReceiptService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(
    auth: AuthContext,
    debtId: number,
    input: {
      amount: number;
      method: 'cash' | 'mtn_momo' | 'moov_money' | 'other';
      reference?: string;
      amountTendered?: number;
      note?: string;
    },
  ) {
    const debt = await this.debts.findByIdAndShop(debtId, auth.shopId);
    if (!debt) throw new DebtNotFoundException(debtId);

    this.validation.assertDebtIsRepayable(debt.status);
    this.validation.assertDebtRepaymentAmount(input.amount, debt.amountRemaining);
    this.validation.assertMomoReference(input.method, input.reference);
    const changeGiven = this.validation.computeChangeGiven(
      input.method,
      input.amount,
      input.amountTendered,
    );

    const timestamp = nowMs();
    const receiptNumber = await this.receipts.generate(auth.shopId, timestamp);
    const newAmountPaid = debt.amountPaid + input.amount;
    const newAmountRemaining = debt.amountRemaining - input.amount;
    const newStatus = this.validation.resolveDebtStatusAfterPayment(newAmountRemaining);

    const { paymentId } = await this.debts.recordPayment({
      shop_id: auth.shopId,
      debt_id: debtId,
      customer_id: debt.customerId,
      user_id: auth.userId,
      receipt_number: receiptNumber,
      amount: input.amount,
      method: input.method,
      reference: input.reference?.trim() ?? null,
      change_given: changeGiven,
      note: input.note ?? null,
      created_at: timestamp,
      new_amount_paid: newAmountPaid,
      new_amount_remaining: newAmountRemaining,
      new_status: newStatus,
      updated_at: timestamp,
    });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.DEBT_PAYMENT_RECORDED,
      module: AuditModule.DEBTS,
      entityId: debtId,
      entityTable: 'debts',
      oldValue: {
        amountPaid: debt.amountPaid,
        amountRemaining: debt.amountRemaining,
        status: debt.status,
      },
      newValue: {
        amountPaid: newAmountPaid,
        amountRemaining: newAmountRemaining,
        status: newStatus,
        paymentId,
        receiptNumber,
      },
      reason: input.note ?? 'Remboursement de dette enregistré',
    });

    return {
      debtId,
      paymentId,
      receiptNumber,
      amount: input.amount,
      changeGiven,
      amountRemaining: newAmountRemaining,
      status: newStatus,
    };
  }
}

@Injectable()
export class ForgiveDebtUseCase {
  constructor(
    private readonly debts: DebtRepository,
    private readonly validation: PaymentValidationService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, debtId: number, reason: string) {
    if (auth.role !== UserRole.OWNER) {
      throw new DebtForgiveDeniedException();
    }

    this.validation.assertForgiveReason(reason);

    const debt = await this.debts.findByIdAndShop(debtId, auth.shopId);
    if (!debt) throw new DebtNotFoundException(debtId);
    if (!['open', 'partial'].includes(debt.status)) {
      throw new DebtAlreadyForgivenException(debtId);
    }

    const timestamp = nowMs();
    await this.debts.forgive(debtId, auth.shopId, {
      forgiven_by_user_id: auth.userId,
      forgiven_at: timestamp,
      forgiven_reason: reason.trim(),
      updated_at: timestamp,
    });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.DEBT_FORGIVEN,
      module: AuditModule.DEBTS,
      entityId: debtId,
      entityTable: 'debts',
      oldValue: {
        status: debt.status,
        amountRemaining: debt.amountRemaining,
      },
      newValue: { status: 'forgiven', amountRemaining: 0 },
      reason: reason.trim(),
    });

    return { id: debtId, status: 'forgiven', forgivenAt: timestamp };
  }
}
