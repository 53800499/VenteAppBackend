import { Payment, PaymentMethod, PaymentStatus } from '../../domain/entities/payment.entity';
import { PaymentRow } from '../persistence/payment.row';

export class PaymentMapper {
  static toDomain(row: PaymentRow): Payment {
    return new Payment(
      row.id,
      row.shop_id,
      row.sale_id,
      row.debt_id,
      row.customer_id,
      row.user_id,
      row.receipt_number,
      Number(row.amount),
      row.method as PaymentMethod,
      row.reference,
      Number(row.change_given),
      row.status as PaymentStatus,
      row.note,
      row.created_at,
    );
  }
}
