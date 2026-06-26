export interface CustomerRow {
  id: number;
  shop_id: number;
  name: string;
  phone: string | null;
  note: string | null;
  is_archived: boolean;
  created_at: number;
  updated_at: number;
}

export interface CustomerStatsRow {
  balance_due: number;
  open_debts_count: number;
  purchase_count: number;
  total_purchases: number;
  last_activity_at: number | null;
}

export interface CustomerSaleRow {
  id: number;
  receipt_number: string | null;
  total_amount: number;
  status: string;
  created_at: number;
}
