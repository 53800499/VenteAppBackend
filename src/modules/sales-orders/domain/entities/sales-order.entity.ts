export type SalesOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'preparing'
  | 'partially_delivered'
  | 'delivered'
  | 'cancelled'
  | 'closed';

export interface SalesOrderItemEntity {
  id: number;
  productId: number;
  quantityOrdered: number;
  quantityDelivered: number;
  quantityRefused: number;
  quantityReplaced: number;
  unitPrice: number;
  lineTotal: number;
  serverId?: string | null;
}

export interface SalesOrderDeliveryItemEntity {
  id?: number;
  salesOrderItemId: number;
  productId: number;
  quantitySent: number;
  quantityAccepted: number;
  quantityRefused: number;
  quantityReplaced?: number;
  refusalReason?: string;
  refusalDestination?: string;
  replacementProductId?: number | null;
  replacementUnitPrice?: number | null;
  unitPrice: number;
}

export interface SalesOrderDeliveryEntity {
  id: number;
  number: string;
  status: string;
  deliveredAt: number;
  deliveredBy: number;
  notes?: string;
  driverName?: string;
  vehiclePlate?: string;
  remainingReason?: string;
  saleId?: number | null;
  items: SalesOrderDeliveryItemEntity[];
  serverId?: string | null;
}

export interface SalesOrderEntity {
  id: number;
  shopId: number;
  customerId: number;
  number: string;
  status: SalesOrderStatus;
  orderedAt: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  createdBy: number;
  updatedBy?: number | null;
  deviceId?: string | null;
  createdAt: number;
  updatedAt: number;
  version: number;
  serverId?: string | null;
  items: SalesOrderItemEntity[];
  deliveries: SalesOrderDeliveryEntity[];
}

/** Statut après une livraison (reliquat). */
export function computeStatusAfterFulfillment(
  items: Pick<
    SalesOrderItemEntity,
    | 'quantityOrdered'
    | 'quantityDelivered'
    | 'quantityRefused'
    | 'quantityReplaced'
  >[],
  current: SalesOrderStatus,
): SalesOrderStatus {
  const remaining = items.reduce(
    (s, i) =>
      s +
      Math.max(
        0,
        i.quantityOrdered -
          i.quantityDelivered -
          i.quantityRefused -
          (i.quantityReplaced ?? 0),
      ),
    0,
  );
  const delivered = items.reduce((s, i) => s + i.quantityDelivered, 0);
  if (remaining <= 0) return 'delivered';
  if (delivered > 0) return 'partially_delivered';
  if (current === 'confirmed') return 'preparing';
  return current;
}
