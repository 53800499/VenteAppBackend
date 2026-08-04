export interface JwtAccessPayload {
  sub: any;
  role?: string;
  sid?: string;
  isAdmin?: boolean;
  adminRole?: string;
  type: 'access';
}


export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  tokenType: 'Bearer';
}
