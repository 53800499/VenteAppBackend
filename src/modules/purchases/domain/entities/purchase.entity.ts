export type PurchaseOrderStatus =
  | 'draft'
  | 'validated'
  | 'sent'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export type SupplierInvoiceStatus = 'unpaid' | 'partially_paid' | 'paid';

export type PurchasePaymentMethod =
  | 'cash'
  | 'mtn_momo'
  | 'moov_money'
  | 'card'
  | 'transfer'
  | 'check';

export interface Supplier {
  id: number;
  shopId: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
  serverId: string | null;
}

export interface PurchaseOrder {
  id: number;
  shopId: number;
  supplierId: number;
  supplierName?: string;
  number: string;
  status: PurchaseOrderStatus;
  orderedAt: number;
  expectedAt: number | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  createdBy: number;
  createdByName?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  serverId: string | null;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: number;
  shopId: number;
  purchaseOrderId: number;
  productId: number;
  productName?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  discount: number;
  tax: number;
  subtotal: number;
  version: number;
  serverId: string | null;
}

export interface PurchaseReceipt {
  id: number;
  shopId: number;
  purchaseOrderId: number | null;
  supplierId: number;
  supplierName?: string;
  receiptType: 'direct' | 'from_order';
  receiptNumber: string;
  receivedAt: number;
  receivedBy: number;
  receivedByName?: string;
  notes: string | null;
  version: number;
  serverId: string | null;
  items?: PurchaseReceiptItem[];
}

export interface PurchaseReceiptItem {
  id: number;
  shopId: number;
  purchaseReceiptId: number;
  purchaseOrderItemId: number | null;
  productId: number;
  productName?: string;
  quantityReceived: number;
  unitCost: number;
  batchNumber: string | null;
  expiryDate: number | null;
  version: number;
  serverId: string | null;
}

export interface SupplierInvoice {
  id: number;
  shopId: number;
  purchaseOrderId: number | null;
  invoiceNumber: string;
  supplierId: number;
  supplierName?: string;
  invoiceDate: number;
  dueDate: number | null;
  subtotal: number;
  tax: number;
  total: number;
  status: SupplierInvoiceStatus;
  createdAt: number;
  updatedAt: number;
  version: number;
  serverId: string | null;
  payments?: SupplierPayment[];
}

export interface SupplierPayment {
  id: number;
  shopId: number;
  invoiceId: number;
  amount: number;
  paymentMethod: PurchasePaymentMethod;
  paymentDate: number;
  reference: string | null;
  createdAt: number;
  version: number;
  serverId: string | null;
}

export interface PurchaseOrderHistory {
  id: number;
  shopId: number;
  purchaseOrderId: number;
  action: string;
  performedBy: number;
  performedByName?: string;
  performedAt: number;
  details: string | null;
}
