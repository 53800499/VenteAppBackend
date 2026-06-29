import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { AuditLogRepository } from '../../../audit/domain/repositories/audit-log.repository';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { PaymentReceiptService } from '../../../payments/domain/services/payment-receipt.service';
import { Debt } from '../../domain/entities/debt.entity';
import { DebtRepository } from '../../domain/repositories/debt.repository';
import { DebtValidationService } from '../../domain/services/debt-validation.service';
import {
  DebtAlreadyForgivenException,
  DebtForgiveDeniedException,
  DebtNotFoundException,
} from '../../exceptions/debts.exceptions';

function lastPaymentAt(debt: Debt): number | null {
  if (debt.payments.length === 0) return null;
  return debt.payments[debt.payments.length - 1]!.createdAt;
}

function toDebtResponse(debt: Debt, validation: DebtValidationService, now = nowMs()) {
  const lastPay = lastPaymentAt(debt);
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
    isCritical: validation.isCriticalDebt(debt.createdAt, debt.amountPaid, now),
    daysWithoutPayment: validation.computeDaysWithoutPayment(
      debt.createdAt,
      debt.amountPaid,
      lastPay,
      now,
    ),
    lastPaymentAt: lastPay,
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
export class GetDebtsSummaryUseCase {
  constructor(private readonly debts: DebtRepository) {}

  async execute(auth: AuthContext) {
    return this.debts.getShopSummary(auth.shopId);
  }
}

@Injectable()
export class ListDebtsUseCase {
  constructor(
    private readonly debts: DebtRepository,
    private readonly validation: DebtValidationService,
  ) {}

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
    return rows.map((debt) => toDebtResponse(debt, this.validation, now));
  }
}

@Injectable()
export class GetDebtUseCase {
  constructor(
    private readonly debts: DebtRepository,
    private readonly validation: DebtValidationService,
  ) {}

  async execute(auth: AuthContext, debtId: number) {
    const debt = await this.debts.findByIdAndShop(debtId, auth.shopId, true);
    if (!debt) throw new DebtNotFoundException(debtId);
    return toDebtResponse(debt, this.validation);
  }
}

@Injectable()
export class GetDebtHistoryUseCase {
  constructor(
    private readonly debts: DebtRepository,
    private readonly auditLogs: AuditLogRepository,
  ) {}

  async execute(auth: AuthContext, debtId: number) {
    const debt = await this.debts.findByIdAndShop(debtId, auth.shopId, true);
    if (!debt) throw new DebtNotFoundException(debtId);

    const timeline = await this.auditLogs.listByEntity(auth.shopId, 'debts', debtId);

    return {
      debtId,
      timeline: timeline.map((entry) => ({
        id: entry.id,
        action: entry.action,
        userName: entry.userName,
        reason: entry.reason,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        createdAt: entry.createdAt,
      })),
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
}

@Injectable()
export class RecordDebtPaymentUseCase {
  constructor(
    private readonly debts: DebtRepository,
    private readonly validation: DebtValidationService,
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
    private readonly validation: DebtValidationService,
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
