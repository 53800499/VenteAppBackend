import { AuthSession } from '../../domain/entities/auth-session.entity';
import { AuthSessionRow } from '../persistence/auth-session.row';

export class AuthSessionMapper {
  static toDomain(row: AuthSessionRow): AuthSession {
    return new AuthSession(
      row.id,
      row.user_id,
      row.shop_id,
      row.pin_verified_at,
      row.expires_at,
      row.last_activity_at,
      row.created_at,
    );
  }
}
