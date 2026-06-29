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
