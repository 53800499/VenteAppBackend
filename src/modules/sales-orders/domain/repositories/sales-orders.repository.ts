import { SalesOrderEntity, SalesOrderStatus } from '../entities/sales-order.entity';

export abstract class SalesOrdersRepository {
  abstract list(shopId: string, status?: SalesOrderStatus): Promise<SalesOrderEntity[]>;
  abstract findById(shopId: string, id: string): Promise<SalesOrderEntity | null>;
  abstract save(order: SalesOrderEntity): Promise<SalesOrderEntity>;
}
