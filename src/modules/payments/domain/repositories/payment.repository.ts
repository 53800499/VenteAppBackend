import { Payment, PaymentMethod, PaymentStatus } from '../entities/payment.entity';

export interface CreatePaymentData {
  shop_id: number;
  sale_id?: number | null;
  debt_id?: number | null;
  customer_id?: number | null;
  user_id: number;
  receipt_number?: string | null;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  change_given: number;
  status: PaymentStatus;
  note?: string | null;
  created_at: number;
}

export interface PaymentListFilters {
  saleId?: number;
  debtId?: number;
  customerId?: number;
  method?: PaymentMethod;
  from?: number;
  to?: number;
  limit?: number;
}

export abstract class PaymentRepository {
  abstract findByIdAndShop(id: number, shopId: number): Promise<Payment | null>;
  abstract listByShop(shopId: number, filters?: PaymentListFilters): Promise<Payment[]>;
  abstract countByShopOnDay(shopId: number, dayStartMs: number, dayEndMs: number): Promise<number>;
  abstract create(data: CreatePaymentData): Promise<Payment>;
}
