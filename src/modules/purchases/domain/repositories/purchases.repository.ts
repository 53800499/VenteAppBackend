import {
  PurchaseOrder,
  PurchaseOrderHistory,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseReceipt,
  PurchaseReceiptItem,
  Supplier,
  SupplierInvoice,
  SupplierInvoiceStatus,
  SupplierPayment,
  PurchasePaymentMethod,
} from '../entities/purchase.entity';

export interface CreateSupplierData {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface UpdateSupplierData {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export interface CreatePurchaseOrderData {
  supplierId: number;
  number: string;
  orderedAt: number;
  expectedAt?: number | null;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  notes?: string | null;
  createdBy: number;
}

export interface UpdatePurchaseOrderData {
  supplierId?: number;
  number?: string;
  orderedAt?: number;
  expectedAt?: number | null;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  notes?: string | null;
}

export interface CreatePurchaseOrderItemData {
  productId: number;
  quantityOrdered: number;
  unitCost: number;
  discount?: number;
  tax?: number;
  subtotal: number;
}

export interface CreateReceiptData {
  purchaseOrderId: number;
  receiptNumber: string;
  receivedAt: number;
  receivedBy: number;
  notes?: string | null;
}

export interface CreateReceiptItemData {
  purchaseOrderItemId: number;
  productId: number;
  quantityReceived: number;
  unitCost: number;
  batchNumber?: string | null;
  expiryDate?: number | null;
}

export interface CreateInvoiceData {
  purchaseOrderId?: number | null;
  invoiceNumber: string;
  supplierId: number;
  invoiceDate: number;
  dueDate?: number | null;
  subtotal: number;
  tax?: number;
  total: number;
}

export interface CreatePaymentData {
  invoiceId: number;
  amount: number;
  paymentMethod: PurchasePaymentMethod;
  paymentDate: number;
  reference?: string | null;
}

export interface ListPurchaseOrdersFilters {
  supplierId?: number;
  status?: PurchaseOrderStatus;
  fromMs?: number;
  toMs?: number;
}

export abstract class PurchasesRepository {
  // Suppliers
  abstract listSuppliers(shopId: number): Promise<Supplier[]>;
  abstract findSupplier(shopId: number, id: number): Promise<Supplier | null>;
  abstract createSupplier(shopId: number, data: CreateSupplierData): Promise<Supplier>;
  abstract updateSupplier(shopId: number, id: number, data: UpdateSupplierData): Promise<Supplier>;

  // Purchase Orders
  abstract listPurchaseOrders(shopId: number, filters?: ListPurchaseOrdersFilters): Promise<PurchaseOrder[]>;
  abstract findPurchaseOrder(shopId: number, id: number): Promise<PurchaseOrder | null>;
  abstract createPurchaseOrder(
    shopId: number,
    data: CreatePurchaseOrderData,
    items: CreatePurchaseOrderItemData[],
  ): Promise<PurchaseOrder>;
  abstract updatePurchaseOrder(
    shopId: number,
    id: number,
    data: UpdatePurchaseOrderData,
    items?: CreatePurchaseOrderItemData[],
  ): Promise<PurchaseOrder>;
  abstract updatePurchaseOrderStatus(shopId: number, id: number, status: PurchaseOrderStatus): Promise<void>;
  
  // History
  abstract addHistory(shopId: number, poId: number, action: string, userId: number, details?: string | null): Promise<void>;
  abstract listHistory(shopId: number, poId: number): Promise<PurchaseOrderHistory[]>;

  // Receipts
  abstract createReceipt(
    shopId: number,
    data: CreateReceiptData,
    items: CreateReceiptItemData[],
  ): Promise<PurchaseReceipt>;
  abstract listReceipts(shopId: number, poId: number): Promise<PurchaseReceipt[]>;

  // Invoices & Payments
  abstract createInvoice(shopId: number, data: CreateInvoiceData): Promise<SupplierInvoice>;
  abstract findInvoice(shopId: number, id: number): Promise<SupplierInvoice | null>;
  abstract listInvoices(shopId: number, supplierId?: number): Promise<SupplierInvoice[]>;
  abstract createPayment(shopId: number, data: CreatePaymentData): Promise<SupplierPayment>;
  abstract updateInvoiceStatus(shopId: number, invoiceId: number, status: SupplierInvoiceStatus): Promise<void>;
  abstract sumPaymentsForInvoice(shopId: number, invoiceId: number): Promise<number>;
}
