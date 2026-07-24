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
  abstract sumReturnedBySaleItem(
    shopId: number,
    saleId: number,
  ): Promise<Map<number, number>>;
  abstract createReplacement(data: {
    shop_id: number;
    sale_id: number;
    number: string;
    replaced_at: number;
    replaced_by: number;
    notes: string | null;
    items: Array<{
      returned_sale_item_id: number;
      returned_product_id: number;
      quantity_returned: number;
      issued_product_id: number;
      quantity_issued: number;
      unit_price_issued: number;
      reason: string;
    }>;
  }): Promise<{ id: number; number: string; serverId: string | null }>;
  abstract findSalesOrderIdBySale(
    shopId: number,
    saleId: number,
  ): Promise<number | null>;
  abstract addSalesOrderHistory(data: {
    shop_id: number;
    sales_order_id: number;
    action: string;
    performed_by: number;
    performed_at: number;
    details: string;
  }): Promise<void>;
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
