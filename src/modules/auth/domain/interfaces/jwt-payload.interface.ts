export interface JwtAccessPayload {
  sub: number;
  role: string;
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
