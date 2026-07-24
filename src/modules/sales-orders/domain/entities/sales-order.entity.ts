export type SalesOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'preparing'
  | 'partially_delivered'
  | 'delivered'
  | 'cancelled'
  | 'closed';

export interface SalesOrderItemEntity {
  id: string;
  productId: string;
  quantityOrdered: number;
  quantityDelivered: number;
  quantityRefused: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SalesOrderDeliveryItemEntity {
  salesOrderItemId: string;
  productId: string;
  quantitySent: number;
  quantityAccepted: number;
  quantityRefused: number;
  refusalReason?: string;
  unitPrice: number;
}

export interface SalesOrderDeliveryEntity {
  id: string;
  number: string;
  deliveredAt: number;
  notes?: string;
  driverName?: string;
  vehiclePlate?: string;
  saleId?: string;
  items: SalesOrderDeliveryItemEntity[];
}

export interface SalesOrderEntity {
  id: string;
  shopId: string;
  customerId: string;
  number: string;
  status: SalesOrderStatus;
  orderedAt: number;
  subtotal: number;
  total: number;
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  items: SalesOrderItemEntity[];
  deliveries: SalesOrderDeliveryEntity[];
}
