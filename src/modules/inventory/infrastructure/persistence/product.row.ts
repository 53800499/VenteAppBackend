export interface ProductRow {
  id: number;
  shop_id: number;
  category_id: number | null;
  name: string;
  sku: string | null;
  quantity_in_stock: number;
  alert_threshold: number | null;
  price_buy: number | null;
  price_sell: number;
  price_semi_wholesale?: number | null;
  price_wholesale?: number | null;
  is_archived: boolean;
  created_at: number;
  updated_at: number;
  version: number;
  server_id?: string;
  sync_status?: string | null;
}
