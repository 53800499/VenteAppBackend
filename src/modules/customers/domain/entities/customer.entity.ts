export class Customer {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly name: string,
    public readonly phone: string | null,
    public readonly note: string | null,
    public readonly isArchived: boolean,
    public readonly createdAt: number,
    public readonly updatedAt: number,
    public readonly balanceDue: number = 0,
    public readonly openDebtsCount: number = 0,
    public readonly purchaseCount: number = 0,
    public readonly totalPurchases: number = 0,
    public readonly lastActivityAt: number | null = null,
  ) {}
}

export class CustomerSaleSummary {
  constructor(
    public readonly id: number,
    public readonly receiptNumber: string | null,
    public readonly totalAmount: number,
    public readonly status: string,
    public readonly createdAt: number,
  ) {}
}
