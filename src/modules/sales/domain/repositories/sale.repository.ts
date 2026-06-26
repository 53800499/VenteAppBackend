import { PaymentMethod, Sale, SaleItem, SaleStatus, SaleType } from '../entities/sale.entity';

export interface SaleLineInput {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  discount_amount: number;
  line_total: number;
}

export interface CreateSaleData {
  shop_id: number;
  receipt_number: string;
  customer_id: number | null;
  user_id: number;
  sale_type: SaleType;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_cash: number;
  amount_momo: number;
  amount_credit: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  note?: string | null;
  created_at: number;
  updated_at: number;
}

export interface SaleListFilters {
  status?: SaleStatus;
  saleType?: SaleType;
  customerId?: number;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

export abstract class SaleRepository {
  abstract findByIdAndShop(id: number, shopId: number): Promise<Sale | null>;
  abstract listByShop(shopId: number, filters?: SaleListFilters): Promise<Sale[]>;
  abstract countByShopOnDay(shopId: number, dayStartMs: number, dayEndMs: number): Promise<number>;
  abstract createWithItems(sale: CreateSaleData, items: SaleLineInput[]): Promise<Sale>;
  abstract cancel(
    id: number,
    shopId: number,
    data: {
      cancel_reason: string;
      cancelled_by_user_id: number;
      cancelled_at: number;
      updated_at: number;
      version: number;
    },
  ): Promise<void>;
}

export abstract class SaleCustomerRepository {
  abstract findByIdAndShop(id: number, shopId: number): Promise<{ id: number; name: string } | null>;
}

export abstract class SaleDebtRepository {
  abstract findBySaleId(saleId: number, shopId: number): Promise<{
    id: number;
    amountPaid: number;
    amountRemaining: number;
    status: string;
  } | null>;
  abstract create(data: Record<string, unknown>): Promise<{ id: number }>;
  abstract closeBySaleId(saleId: number, shopId: number, updatedAt: number): Promise<void>;
}
