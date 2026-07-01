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
  shop_phone?: string | null;
  shop_address?: string | null;
  shop_logo_path: string | null;
  currency?: string;
  language?: string;
  default_alert_threshold?: number;
  auto_lock_minutes: number;
  receipt_footer?: string | null;
  backup_last_at?: number | null;
  backup_path?: string | null;
  cloud_sync_enabled?: boolean;
  cloud_last_sync_at?: number | null;
  updated_at?: number;
}
