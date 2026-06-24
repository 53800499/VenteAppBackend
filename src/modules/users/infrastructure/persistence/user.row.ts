import { UserRole } from '../../../../shared/enums/user-role.enum';

export interface UserRow {
  id: number;
  shop_id: number;
  name: string;
  pin_hash: string;
  role: UserRole;
  is_active: boolean;
  avatar_path: string | null;
  last_login_at: number | null;
  failed_attempts: number;
  locked_until: number | null;
  lockout_count: number;
  emergency_recovery_hash: string | null;
  biometric_enabled: boolean;
  created_at: number;
  updated_at: number;
  version: number;
}
