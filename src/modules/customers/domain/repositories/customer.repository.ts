import { Customer, CustomerSaleSummary } from '../entities/customer.entity';

export type CustomerSortField = 'name' | 'debt' | 'lastActivity';

export interface CustomerListFilters {
  search?: string;
  includeArchived?: boolean;
  hasDebt?: boolean;
  sort?: CustomerSortField;
  limit?: number;
}

export interface CreateCustomerData {
  shop_id: number;
  name: string;
  phone?: string | null;
  note?: string | null;
  created_at: number;
  updated_at: number;
}

export interface DebtorSummaryRow {
  customerId: number;
  customerName: string;
  phone: string | null;
  balanceDue: number;
  openDebtsCount: number;
  oldestDebtAt: number;
}

export abstract class CustomerRepository {
  abstract findByIdAndShop(id: number, shopId: number, includeArchived?: boolean): Promise<Customer | null>;
  abstract listByShop(shopId: number, filters?: CustomerListFilters): Promise<Customer[]>;
  abstract listDebtors(shopId: number): Promise<DebtorSummaryRow[]>;
  abstract create(data: CreateCustomerData): Promise<Customer>;
  abstract updateInShop(id: number, shopId: number, patch: Record<string, unknown>): Promise<Customer>;
  abstract archive(id: number, shopId: number, updatedAt: number): Promise<void>;
  abstract countOpenDebts(id: number, shopId: number): Promise<number>;
  abstract listSales(id: number, shopId: number, limit?: number): Promise<CustomerSaleSummary[]>;
}
