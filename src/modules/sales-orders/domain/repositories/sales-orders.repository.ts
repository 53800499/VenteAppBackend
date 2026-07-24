import {
  SalesOrderDeliveryItemEntity,
  SalesOrderEntity,
  SalesOrderStatus,
} from '../entities/sales-order.entity';

export type CreateSalesOrderItemData = {
  productId: number;
  quantityOrdered: number;
  unitPrice: number;
  lineTotal: number;
};

export type CreateSalesOrderData = {
  customerId: number;
  number: string;
  orderedAt: number;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  notes?: string;
  createdBy: number;
  deviceId?: string | null;
  items: CreateSalesOrderItemData[];
};

export type InsertDeliveryItemData = SalesOrderDeliveryItemEntity;

export type InsertDeliveryData = {
  number: string;
  deliveredAt: number;
  deliveredBy: number;
  notes?: string;
  driverName?: string;
  vehiclePlate?: string;
  remainingReason?: string | null;
  saleId?: number | null;
  version?: number;
  deviceId?: string | null;
  historyPayload?: Record<string, unknown> | null;
  items: InsertDeliveryItemData[];
};

export type UpdateStatusOpts = {
  notes?: string;
  performedBy: number;
  historyAction: string;
  historyDetails?: string;
  historyPayload?: Record<string, unknown> | null;
  /** Version locale post-bump (optimistic lock). */
  version?: number;
  deviceId?: string | null;
};

export abstract class SalesOrdersRepository {
  abstract list(
    shopId: number,
    status?: SalesOrderStatus,
    updatedAfter?: number,
  ): Promise<SalesOrderEntity[]>;

  abstract findById(
    shopId: number,
    id: number,
  ): Promise<SalesOrderEntity | null>;

  abstract findByNumber(
    shopId: number,
    number: string,
  ): Promise<SalesOrderEntity | null>;

  abstract create(
    shopId: number,
    data: CreateSalesOrderData,
  ): Promise<SalesOrderEntity>;

  abstract updateStatus(
    shopId: number,
    id: number,
    status: SalesOrderStatus,
    opts?: UpdateStatusOpts,
  ): Promise<SalesOrderEntity>;

  abstract insertDelivery(
    shopId: number,
    orderId: number,
    data: InsertDeliveryData,
  ): Promise<SalesOrderEntity>;
}
