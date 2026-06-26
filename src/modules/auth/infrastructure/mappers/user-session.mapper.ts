import { UserSession } from '../../domain/entities/user-session.entity';
import { UserSessionRow } from '../persistence/user-session.row';

export class UserSessionMapper {
  static toDomain(row: UserSessionRow): UserSession {
    return new UserSession(
      row.id,
      row.user_id,
      row.shop_id,
      row.device_id,
      row.device_label,
      row.refresh_token_hash,
      row.pin_verified_at,
      row.last_seen_at,
      row.session_expires_at,
      row.refresh_expires_at,
      row.revoked_at,
      row.replaced_by_id,
      row.created_at,
    );
  }
}
