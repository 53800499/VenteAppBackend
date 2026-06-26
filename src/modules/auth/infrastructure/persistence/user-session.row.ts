export interface UserSessionRow {
  id: string;
  user_id: number;
  shop_id: number;
  device_id: string;
  device_label: string | null;
  refresh_token_hash: string;
  pin_verified_at: number;
  last_seen_at: number;
  session_expires_at: number;
  refresh_expires_at: number;
  revoked_at: number | null;
  replaced_by_id: string | null;
  created_at: number;
}
