import { UserRole } from '../enums/user-role.enum';
import { Permission } from '../enums/permission.enum';

export interface AuthContext {
  userId: number;
  shopId: number;
  role: UserRole;
  permissions: Permission[];
  /** ID session interne (auth_sessions) — non exposé au client */
  sessionId: string;
}

export interface AuthenticatedRequest {
  headers: Record<string, string>;
  authContext?: AuthContext;
}
