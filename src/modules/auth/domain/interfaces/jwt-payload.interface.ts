import { UserRole } from '../../../../shared/enums/user-role.enum';

export interface JwtAccessPayload {
  sub: number;
  role: UserRole;
  sid: string;
  type: 'access';
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  tokenType: 'Bearer';
}
