import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  pinMinLength: 4,
  pinMaxLength: 6,
  bcryptCost: 10,
  maxFailedAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000,
  maxLockoutPeriods: 3,
  defaultAutoLockMinutes: 5,
  shopIdHeader: 'x-shop-id',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-change-me-in-production',
  jwtIssuer: process.env.JWT_ISSUER ?? 'venteapp-api',
  jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
  otpLength: Number(process.env.OTP_LENGTH ?? 6),
  otpTtlMs: Number(process.env.OTP_TTL_MS ?? 5 * 60 * 1000),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  otpResendCooldownMs: Number(process.env.OTP_RESEND_COOLDOWN_MS ?? 60 * 1000),
  otpVerificationJwtTtlSeconds: Number(process.env.OTP_VERIFICATION_JWT_TTL_SECONDS ?? 300),
}));
