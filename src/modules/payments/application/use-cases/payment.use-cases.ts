import { Injectable } from '@nestjs/common';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentRepository } from '../../domain/repositories/payment.repository';
import { PaymentNotFoundException } from '../../exceptions/payments.exceptions';

function toPaymentResponse(payment: Payment) {
  return {
    id: payment.id,
    saleId: payment.saleId,
    debtId: payment.debtId,
    customerId: payment.customerId,
    receiptNumber: payment.receiptNumber,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    changeGiven: payment.changeGiven,
    status: payment.status,
    note: payment.note,
    createdAt: payment.createdAt,
  };
}

@Injectable()
export class ListPaymentsUseCase {
  constructor(private readonly payments: PaymentRepository) {}

  async execute(
    auth: AuthContext,
    filters?: {
      saleId?: number;
      debtId?: number;
      customerId?: number;
      method?: string;
      from?: number;
      to?: number;
      limit?: number;
    },
  ) {
    const rows = await this.payments.listByShop(auth.shopId, {
      saleId: filters?.saleId,
      debtId: filters?.debtId,
      customerId: filters?.customerId,
      method: filters?.method as Payment['method'] | undefined,
      from: filters?.from,
      to: filters?.to,
      limit: filters?.limit ?? 50,
    });
    return rows.map(toPaymentResponse);
  }
}

@Injectable()
export class GetPaymentUseCase {
  constructor(private readonly payments: PaymentRepository) {}

  async execute(auth: AuthContext, paymentId: number) {
    const payment = await this.payments.findByIdAndShop(paymentId, auth.shopId);
    if (!payment) throw new PaymentNotFoundException(paymentId);
    return toPaymentResponse(payment);
  }
}
