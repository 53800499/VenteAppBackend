import { UnauthorizedException } from '@nestjs/common';

export function extractActiveShopIdHeader(
  headers: Record<string, string | string[] | undefined>,
): number | undefined {
  const raw = headers['x-shop-id'] ?? headers['X-Shop-Id'];
  if (!raw) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function extractBearerToken(headers: Record<string, string | string[] | undefined>): string | null {
  const authorization = headers.authorization ?? headers.Authorization;
  if (!authorization || Array.isArray(authorization)) {
    return null;
  }
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token.trim();
}

export function isJwtFormat(token: string): boolean {
  return token.split('.').length === 3;
}

export function requireBearerJwt(bearer: string | null): string {
  if (!bearer || !isJwtFormat(bearer)) {
    throw new UnauthorizedException('JWT Bearer requis (Authorization: Bearer <accessToken>).');
  }
  return bearer;
}
