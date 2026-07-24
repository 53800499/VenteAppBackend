import { Injectable } from '@nestjs/common';
import {
  SalesOrderDeliveryEntity,
  SalesOrderEntity,
  SalesOrderStatus,
} from '../../domain/entities/sales-order.entity';
import { SalesOrdersRepository } from '../../domain/repositories/sales-orders.repository';

@Injectable()
export class InMemorySalesOrdersRepository extends SalesOrdersRepository {
  private readonly byShop = new Map<string, Map<string, SalesOrderEntity>>();

  private shopMap(shopId: string): Map<string, SalesOrderEntity> {
    let map = this.byShop.get(shopId);
    if (!map) {
      map = new Map();
      this.byShop.set(shopId, map);
    }
    return map;
  }

  async list(
    shopId: string,
    status?: SalesOrderStatus,
  ): Promise<SalesOrderEntity[]> {
    const all = [...this.shopMap(shopId).values()];
    const filtered = status ? all.filter((o) => o.status === status) : all;
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async findById(
    shopId: string,
    id: string,
  ): Promise<SalesOrderEntity | null> {
    return this.shopMap(shopId).get(id) ?? null;
  }

  async save(order: SalesOrderEntity): Promise<SalesOrderEntity> {
    this.shopMap(order.shopId).set(order.id, structuredClone(order));
    return structuredClone(order);
  }
}

export function appendDelivery(
  order: SalesOrderEntity,
  delivery: SalesOrderDeliveryEntity,
): SalesOrderEntity {
  const items = order.items.map((item) => {
    const line = delivery.items.find((d) => d.salesOrderItemId === item.id);
    if (!line) return item;
    return {
      ...item,
      quantityDelivered: item.quantityDelivered + line.quantityAccepted,
      quantityRefused: item.quantityRefused + line.quantityRefused,
    };
  });
  const remaining = items.reduce(
    (s, i) =>
      s +
      Math.max(0, i.quantityOrdered - i.quantityDelivered - i.quantityRefused),
    0,
  );
  const delivered = items.reduce((s, i) => s + i.quantityDelivered, 0);
  let status: SalesOrderStatus = order.status;
  if (remaining <= 0) status = 'delivered';
  else if (delivered > 0) status = 'partially_delivered';
  else if (status === 'confirmed') status = 'preparing';

  return {
    ...order,
    items,
    deliveries: [delivery, ...order.deliveries],
    status,
    updatedAt: Date.now(),
  };
}
