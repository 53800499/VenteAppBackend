export interface ShopRow {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  owner_user_id: number | null;
  is_active: boolean;
  is_default: boolean;
  created_at: number;
}

export interface SettingsRow {
  id: number;
  shop_id: number;
  shop_name: string;
  shop_logo_path: string | null;
  auto_lock_minutes: number;
}
