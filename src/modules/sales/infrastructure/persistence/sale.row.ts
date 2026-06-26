import { PaymentMethod, SaleStatus, SaleType } from '../../domain/entities/sale.entity';

export interface SaleRow {
  id: number;
  shop_id: number;
  receipt_number: string | null;
  reference: string | null;
  customer_id: number | null;
  user_id: number;
  sale_type: SaleType | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number;
  amount_paid: number | null;
  amount_cash: number;
  amount_momo: number;
  amount_credit: number;
  payment_method: PaymentMethod | null;
  status: SaleStatus;
  cancel_reason: string | null;
  cancelled_by_user_id: number | null;
  cancelled_at: number | null;
  note: string | null;
  created_at: number;
  updated_at: number | null;
  version: number;
}

export interface SaleItemRow {
  id: number;
  shop_id: number;
  sale_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  discount_amount: number | null;
  line_total: number;
  created_at: number;
}
