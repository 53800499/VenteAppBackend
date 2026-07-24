import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CancelSalesOrderDto,
  CreateSalesOrderDto,
  DeliverSalesOrderDto,
} from '../dto/sales-order.dto';
import { SalesOrderEntity } from '../../domain/entities/sales-order.entity';
import { SalesOrdersRepository } from '../../domain/repositories/sales-orders.repository';
import { appendDelivery } from '../../infrastructure/repositories/in-memory-sales-orders.repository';

@Injectable()
export class ListSalesOrdersUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  execute(shopId: string, status?: string) {
    return this.repo.list(
      shopId,
      status as SalesOrderEntity['status'] | undefined,
    );
  }
}

@Injectable()
export class GetSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(shopId: string, id: string) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }
}

@Injectable()
export class CreateSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(
    shopId: string,
    userId: string,
    dto: CreateSalesOrderDto,
  ): Promise<SalesOrderEntity> {
    if (!dto.items?.length) {
      throw new BadRequestException('Ajoutez au moins un produit');
    }
    const now = Date.now();
    const items = dto.items.map((i) => ({
      id: randomUUID(),
      productId: i.productLocalId,
      quantityOrdered: i.quantityOrdered,
      quantityDelivered: 0,
      quantityRefused: 0,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal ?? i.quantityOrdered * i.unitPrice,
    }));
    const subtotal =
      dto.subtotal ?? items.reduce((s, i) => s + i.lineTotal, 0);
    const order: SalesOrderEntity = {
      id: randomUUID(),
      shopId,
      customerId: dto.customerLocalId,
      number: dto.number,
      status: 'draft',
      orderedAt: dto.orderedAt ?? now,
      subtotal,
      total: dto.total ?? subtotal,
      notes: dto.notes,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      items,
      deliveries: [],
    };
    return this.repo.save(order);
  }
}

@Injectable()
export class ConfirmSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(shopId: string, id: string) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status !== 'draft') {
      throw new BadRequestException('Seuls les brouillons peuvent être confirmés');
    }
    return this.repo.save({
      ...order,
      status: 'confirmed',
      updatedAt: Date.now(),
    });
  }
}

@Injectable()
export class DeliverSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(shopId: string, id: string, dto: DeliverSalesOrderDto) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    if (
      !['confirmed', 'preparing', 'partially_delivered'].includes(order.status)
    ) {
      throw new BadRequestException('Livraison impossible pour ce statut');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Aucune ligne de livraison');
    }
    const delivery = {
      id: randomUUID(),
      number: `DL-${Date.now()}`,
      deliveredAt: Date.now(),
      notes: dto.notes,
      items: dto.items.map((i) => ({
        salesOrderItemId: i.salesOrderItemId,
        productId: i.productId,
        quantitySent: i.quantitySent,
        quantityAccepted: i.quantityAccepted,
        quantityRefused: i.quantityRefused,
        refusalReason: i.refusalReason,
        unitPrice: i.unitPrice,
      })),
    };
    return this.repo.save(appendDelivery(order, delivery));
  }
}

@Injectable()
export class CancelSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(shopId: string, id: string, dto: CancelSalesOrderDto) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    const delivered = order.items.reduce((s, i) => s + i.quantityDelivered, 0);
    if (delivered > 0) {
      throw new BadRequestException('Des livraisons existent déjà');
    }
    return this.repo.save({
      ...order,
      status: 'cancelled',
      notes: dto.reason ? `${order.notes ?? ''}\n${dto.reason}`.trim() : order.notes,
      updatedAt: Date.now(),
    });
  }
}

@Injectable()
export class CloseSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(shopId: string, id: string) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status !== 'delivered') {
      throw new BadRequestException('Seules les commandes livrées peuvent être clôturées');
    }
    return this.repo.save({
      ...order,
      status: 'closed',
      updatedAt: Date.now(),
    });
  }
}
