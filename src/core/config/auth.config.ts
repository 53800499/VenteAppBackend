import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  pinMinLength: 4,
  pinMaxLength: 6,
  bcryptCost: 10,
  maxFailedAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000,
  maxLockoutPeriods: 3,
  defaultAutoLockMinutes: 5,
  sessionHeader: 'x-session-token',
  userIdHeader: 'x-user-id',
  shopIdHeader: 'x-shop-id',
}));
