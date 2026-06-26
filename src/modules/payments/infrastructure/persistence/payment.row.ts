export interface PaymentRow {
  id: number;
  shop_id: number;
  sale_id: number | null;
  debt_id: number | null;
  customer_id: number | null;
  user_id: number;
  receipt_number: string | null;
  amount: number;
  method: string;
  reference: string | null;
  change_given: number;
  status: string;
  note: string | null;
  created_at: number;
}

export interface DebtPaymentRow {
  id: number;
  shop_id: number;
  debt_id: number;
  payment_id: number;
  user_id: number;
  amount: number;
  method: string;
  reference: string | null;
  created_at: number;
}

export interface DebtRow {
  id: number;
  shop_id: number;
  customer_id: number;
  sale_id: number | null;
  user_id: number | null;
  original_amount: number;
  amount_paid: number;
  amount_remaining: number;
  status: string;
  due_at: number | null;
  forgiven_by_user_id: number | null;
  forgiven_at: number | null;
  forgiven_reason: string | null;
  note: string | null;
  created_at: number;
  updated_at: number | null;
  customers?: { name: string } | { name: string }[] | null;
}
