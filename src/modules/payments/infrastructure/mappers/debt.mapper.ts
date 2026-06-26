import { Debt, DebtPayment, DebtStatus } from '../../domain/entities/debt.entity';
import { DebtPaymentRow, DebtRow } from '../persistence/payment.row';

export class DebtMapper {
  static toDomain(row: DebtRow, payments: DebtPaymentRow[] = []): Debt {
    const customerRel = row.customers;
    const customerName = Array.isArray(customerRel)
      ? customerRel[0]?.name ?? null
      : customerRel?.name ?? null;

    return new Debt(
      row.id,
      row.shop_id,
      row.customer_id,
      customerName,
      row.sale_id,
      row.user_id,
      Number(row.original_amount),
      Number(row.amount_paid),
      Number(row.amount_remaining),
      row.status as DebtStatus,
      row.due_at,
      row.forgiven_by_user_id,
      row.forgiven_at,
      row.forgiven_reason,
      row.note,
      row.created_at,
      row.updated_at ?? row.created_at,
      payments.map(
        (p) =>
          new DebtPayment(
            p.id,
            p.debt_id,
            p.payment_id,
            p.user_id,
            Number(p.amount),
            p.method,
            p.reference,
            p.created_at,
          ),
      ),
    );
  }
}
