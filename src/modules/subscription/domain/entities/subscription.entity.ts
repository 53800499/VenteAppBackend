import { SubscriptionPlanCode } from './subscription-plan.entity';

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  GRACE = 'GRACE',
  EXPIRED = 'EXPIRED',
  RESTRICTED = 'RESTRICTED',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export class Subscription {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly planId: string,
    public readonly planCode: SubscriptionPlanCode,
    public readonly status: SubscriptionStatus,
    public readonly startedAt: Date,
    public readonly expiresAt: Date,
    public readonly graceUntil: Date,
    public readonly autoRenew: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  public isGracePeriodActive(now: Date = new Date()): boolean {
    return this.status === SubscriptionStatus.GRACE || (now > this.expiresAt && now <= this.graceUntil);
  }

  public isExpired(now: Date = new Date()): boolean {
    return now > this.graceUntil;
  }
}
