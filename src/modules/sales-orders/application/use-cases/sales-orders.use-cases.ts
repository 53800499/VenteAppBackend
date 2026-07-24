import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CancelSalesOrderDto,
  CreateSalesOrderDto,
  DeliverSalesOrderDto,
  SalesOrderVersionDto,
} from '../dto/sales-order.dto';
import { SalesOrderEntity } from '../../domain/entities/sales-order.entity';
import { SalesOrdersRepository } from '../../domain/repositories/sales-orders.repository';

@Injectable()
export class ListSalesOrdersUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  execute(shopId: number, status?: string, updatedAfter?: number) {
    return this.repo.list(
      shopId,
      status as SalesOrderEntity['status'] | undefined,
      updatedAfter,
    );
  }
}

@Injectable()
export class GetSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(shopId: number, id: number) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }
}

@Injectable()
export class CreateSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(
    shopId: number,
    userId: number,
    dto: CreateSalesOrderDto,
  ): Promise<SalesOrderEntity> {
    if (!dto.items?.length) {
      throw new BadRequestException('Ajoutez au moins un produit');
    }

    const existing = await this.repo.findByNumber(shopId, dto.number);
    if (existing) {
      return existing;
    }

    const items = dto.items.map((i) => ({
      productId: i.productId,
      quantityOrdered: i.quantityOrdered,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal ?? i.quantityOrdered * i.unitPrice,
    }));
    const subtotal =
      dto.subtotal ?? items.reduce((s, i) => s + i.lineTotal, 0);

    return this.repo.create(shopId, {
      customerId: dto.customerId,
      number: dto.number,
      orderedAt: dto.orderedAt ?? Date.now(),
      subtotal,
      discount: dto.discount ?? 0,
      tax: dto.tax ?? 0,
      total: dto.total ?? subtotal,
      notes: dto.notes,
      createdBy: userId,
      deviceId: dto.deviceId ?? null,
      items,
    });
  }
}

@Injectable()
export class ConfirmSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(
    shopId: number,
    id: number,
    userId: number,
    dto?: SalesOrderVersionDto,
  ) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status !== 'draft') {
      throw new BadRequestException('Seuls les brouillons peuvent être confirmés');
    }
    return this.repo.updateStatus(shopId, id, 'confirmed', {
      performedBy: userId,
      historyAction: 'confirmed',
      historyDetails: 'Commande confirmée',
      version: dto?.version,
      deviceId: dto?.deviceId ?? null,
    });
  }
}

@Injectable()
export class PrepareSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(
    shopId: number,
    id: number,
    userId: number,
    dto?: SalesOrderVersionDto,
  ) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    if (!['confirmed', 'preparing'].includes(order.status)) {
      throw new BadRequestException('Préparation impossible pour ce statut');
    }
    return this.repo.updateStatus(shopId, id, 'preparing', {
      performedBy: userId,
      historyAction: 'preparing',
      historyDetails: 'Mise en préparation',
      version: dto?.version,
      deviceId: dto?.deviceId ?? null,
    });
  }
}

@Injectable()
export class DeliverSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(
    shopId: number,
    id: number,
    userId: number,
    dto: DeliverSalesOrderDto,
  ) {
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

    for (const line of dto.items) {
      const item = order.items.find((i) => i.id === line.salesOrderItemId);
      if (!item) {
        throw new BadRequestException(
          `Ligne commande #${line.salesOrderItemId} introuvable`,
        );
      }
      const replaced = line.quantityReplaced ?? 0;
      const remaining =
        item.quantityOrdered -
        item.quantityDelivered -
        item.quantityRefused -
        (item.quantityReplaced ?? 0);
      if (line.quantityAccepted + line.quantityRefused + replaced > remaining) {
        throw new BadRequestException(
          `Quantités trop élevées pour le produit #${item.productId} (reste ${remaining})`,
        );
      }
      if (
        line.quantitySent !==
        line.quantityAccepted + line.quantityRefused + replaced
      ) {
        throw new BadRequestException(
          'Envoyé doit égaler accepté + refusé + remplacé',
        );
      }
      if (line.quantityRefused > 0 && !line.refusalDestination) {
        throw new BadRequestException(
          'Destination du refus requise (return_to_stock | loss)',
        );
      }
      if (replaced > 0 && !line.replacementProductId) {
        throw new BadRequestException(
          'Produit de remplacement requis',
        );
      }
    }

    let remainingAfter = 0;
    for (const item of order.items) {
      const line = dto.items.find((i) => i.salesOrderItemId === item.id);
      const consumed = line
        ? line.quantityAccepted +
          line.quantityRefused +
          (line.quantityReplaced ?? 0)
        : 0;
      const before =
        item.quantityOrdered -
        item.quantityDelivered -
        item.quantityRefused -
        (item.quantityReplaced ?? 0);
      remainingAfter += Math.max(0, before - consumed);
    }
    if (remainingAfter > 0 && !dto.remainingReason) {
      throw new BadRequestException(
        'remainingReason requis lorsqu’un reliquat reste',
      );
    }

    const deliveryNumber = dto.number ?? `DL-${Date.now()}`;

    return this.repo.insertDelivery(shopId, id, {
      number: deliveryNumber,
      deliveredAt: Date.now(),
      deliveredBy: userId,
      notes: dto.notes,
      driverName: dto.driverName,
      vehiclePlate: dto.vehiclePlate,
      remainingReason: remainingAfter > 0 ? dto.remainingReason ?? null : null,
      saleId: dto.saleId ?? null,
      version: dto.version,
      deviceId: dto.deviceId ?? null,
      historyPayload: {
        deliveryNumber,
        remainingReason:
          remainingAfter > 0 ? dto.remainingReason ?? null : null,
        remainingQty: remainingAfter,
      },
      items: dto.items.map((i) => ({
        salesOrderItemId: i.salesOrderItemId,
        productId: i.productId,
        quantitySent: i.quantitySent,
        quantityAccepted: i.quantityAccepted,
        quantityRefused: i.quantityRefused,
        quantityReplaced: i.quantityReplaced ?? 0,
        refusalReason: i.refusalReason,
        refusalDestination: i.refusalDestination,
        replacementProductId: i.replacementProductId ?? null,
        replacementUnitPrice: i.replacementUnitPrice ?? null,
        unitPrice: i.unitPrice,
      })),
    });
  }
}

@Injectable()
export class CancelSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(
    shopId: number,
    id: number,
    userId: number,
    dto: CancelSalesOrderDto,
  ) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    const fulfilled = order.items.reduce(
      (s, i) =>
        s +
        i.quantityDelivered +
        i.quantityRefused +
        (i.quantityReplaced ?? 0),
      0,
    );
    if (fulfilled > 0) {
      throw new BadRequestException('Des livraisons existent déjà');
    }
    const notes = dto.reason
      ? `${order.notes ?? ''}\n${dto.reason}`.trim()
      : order.notes;
    return this.repo.updateStatus(shopId, id, 'cancelled', {
      notes,
      performedBy: userId,
      historyAction: 'cancelled',
      historyDetails: dto.reason ?? 'Annulée',
      historyPayload: dto.reason ? { reason: dto.reason } : null,
      version: dto.version,
      deviceId: dto.deviceId ?? null,
    });
  }
}

@Injectable()
export class CloseSalesOrderUseCase {
  constructor(private readonly repo: SalesOrdersRepository) {}

  async execute(
    shopId: number,
    id: number,
    userId: number,
    dto?: SalesOrderVersionDto,
  ) {
    const order = await this.repo.findById(shopId, id);
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status !== 'delivered') {
      throw new BadRequestException(
        'Seules les commandes livrées peuvent être clôturées',
      );
    }
    return this.repo.updateStatus(shopId, id, 'closed', {
      performedBy: userId,
      historyAction: 'closed',
      historyDetails: 'Commande clôturée',
      version: dto?.version,
      deviceId: dto?.deviceId ?? null,
    });
  }
}
