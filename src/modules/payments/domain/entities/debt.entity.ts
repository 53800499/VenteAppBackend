export type DebtStatus = 'open' | 'partial' | 'paid' | 'cancelled' | 'forgiven';

export class DebtPayment {
  constructor(
    public readonly id: number,
    public readonly debtId: number,
    public readonly paymentId: number,
    public readonly userId: number,
    public readonly amount: number,
    public readonly method: string,
    public readonly reference: string | null,
    public readonly createdAt: number,
  ) {}
}

export class Debt {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly customerId: number,
    public readonly customerName: string | null,
    public readonly saleId: number | null,
    public readonly userId: number | null,
    public readonly originalAmount: number,
    public readonly amountPaid: number,
    public readonly amountRemaining: number,
    public readonly status: DebtStatus,
    public readonly dueAt: number | null,
    public readonly forgivenByUserId: number | null,
    public readonly forgivenAt: number | null,
    public readonly forgivenReason: string | null,
    public readonly note: string | null,
    public readonly createdAt: number,
    public readonly updatedAt: number,
    public readonly payments: DebtPayment[] = [],
  ) {}
}
