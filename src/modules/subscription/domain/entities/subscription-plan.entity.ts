export enum SubscriptionPlanCode {
  FREE = 'FREE',
  STANDARD = 'STANDARD',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export class SubscriptionPlan {
  constructor(
    public readonly id: string,
    public readonly code: SubscriptionPlanCode,
    public readonly name: string,
    public readonly maxUsers: number,
    public readonly maxShops: number,
    public readonly grantedModules: string[],
    public readonly priceMonthly: number,
    public readonly priceYearly: number,
    public readonly createdAt: Date,
  ) {}

  static freePlan(): SubscriptionPlan {
    return new SubscriptionPlan(
      'plan_free',
      SubscriptionPlanCode.FREE,
      'Gratuit',
      1,
      1,
      ['sales'],
      0,
      0,
      new Date(),
    );
  }

  static proPlan(): SubscriptionPlan {
    return new SubscriptionPlan(
      'plan_pro',
      SubscriptionPlanCode.PRO,
      'Pro',
      10,
      10,
      ['sales', 'inventory', 'expenses', 'fx', 'assistant', 'reports', 'multiShop'],
      15000,
      150000,
      new Date(),
    );
  }
}
