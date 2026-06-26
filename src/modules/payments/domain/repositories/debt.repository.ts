import { Debt, DebtStatus } from '../entities/debt.entity';
import { PaymentMethod } from '../entities/payment.entity';

export interface DebtListFilters {
  status?: DebtStatus;
  customerId?: number;
  criticalOnly?: boolean;
  limit?: number;
}

export interface RecordDebtPaymentData {
  shop_id: number;
  debt_id: number;
  customer_id: number;
  user_id: number;
  receipt_number: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  change_given: number;
  note: string | null;
  created_at: number;
  new_amount_paid: number;
  new_amount_remaining: number;
  new_status: DebtStatus;
  updated_at: number;
}

export interface ForgiveDebtData {
  forgiven_by_user_id: number;
  forgiven_at: number;
  forgiven_reason: string;
  updated_at: number;
}

export abstract class DebtRepository {
  abstract findByIdAndShop(id: number, shopId: number, withPayments?: boolean): Promise<Debt | null>;
  abstract listByShop(shopId: number, filters?: DebtListFilters): Promise<Debt[]>;
  abstract recordPayment(data: RecordDebtPaymentData): Promise<{ paymentId: number; debtPaymentId: number }>;
  abstract forgive(id: number, shopId: number, data: ForgiveDebtData): Promise<void>;
}
