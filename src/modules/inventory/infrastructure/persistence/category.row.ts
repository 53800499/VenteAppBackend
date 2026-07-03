export interface CategoryRow {
  id: number;
  shop_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: number;
  updated_at: number;
}
