import { User, UserSummary } from '../../domain/entities/user.entity';
import { UserRow } from '../persistence/user.row';

export class UserMapper {
  static toDomain(row: UserRow): User {
    return new User(
      row.id,
      row.shop_id,
      row.name,
      row.pin_hash,
      row.role,
      row.is_active,
      row.avatar_path,
      row.last_login_at,
      row.failed_attempts,
      row.locked_until,
      row.lockout_count,
      row.emergency_recovery_hash,
      row.biometric_enabled,
      row.created_at,
      row.updated_at,
      row.version,
    );
  }

  static toSummary(row: Pick<UserRow, 'id' | 'name' | 'role' | 'biometric_enabled'>): UserSummary {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      biometricEnabled: row.biometric_enabled,
    };
  }
}
