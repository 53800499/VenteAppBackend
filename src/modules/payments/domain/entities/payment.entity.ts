export type PaymentMethod = 'cash' | 'mtn_momo' | 'moov_money' | 'other';
export type PaymentStatus = 'confirmed' | 'pending' | 'cancelled';

export class Payment {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly saleId: number | null,
    public readonly debtId: number | null,
    public readonly customerId: number | null,
    public readonly userId: number,
    public readonly receiptNumber: string | null,
    public readonly amount: number,
    public readonly method: PaymentMethod,
    public readonly reference: string | null,
    public readonly changeGiven: number,
    public readonly status: PaymentStatus,
    public readonly note: string | null,
    public readonly createdAt: number,
  ) {}
}
