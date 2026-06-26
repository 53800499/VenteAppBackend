export type SaleType = 'standard' | 'quick';
export type SaleStatus = 'completed' | 'partial' | 'cancelled' | 'pending';
export type PaymentMethod = 'cash' | 'mtn_momo' | 'moov_money' | 'credit' | 'mixed';

export class SaleItem {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly saleId: number,
    public readonly productId: number | null,
    public readonly productName: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly unitCost: number | null,
    public readonly discountAmount: number,
    public readonly lineTotal: number,
    public readonly createdAt: number,
  ) {}
}

export class Sale {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly receiptNumber: string,
    public readonly customerId: number | null,
    public readonly userId: number,
    public readonly saleType: SaleType,
    public readonly subtotal: number,
    public readonly discountAmount: number,
    public readonly totalAmount: number,
    public readonly amountPaid: number,
    public readonly amountCash: number,
    public readonly amountMomo: number,
    public readonly amountCredit: number,
    public readonly paymentMethod: PaymentMethod,
    public readonly status: SaleStatus,
    public readonly cancelReason: string | null,
    public readonly cancelledByUserId: number | null,
    public readonly cancelledAt: number | null,
    public readonly note: string | null,
    public readonly createdAt: number,
    public readonly updatedAt: number,
    public readonly version: number,
    public readonly items: SaleItem[] = [],
  ) {}
}
