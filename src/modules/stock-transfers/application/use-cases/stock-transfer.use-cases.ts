import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import {
  InventoryLotSourceType,
  InventoryLotStatus,
} from '../../../inventory/domain/entities/inventory-lot.entity';
import { InventoryLotRepository } from '../../../inventory/domain/repositories/inventory-lot.repository';
import { ProductRepository } from '../../../inventory/domain/repositories/product.repository';
import { CategoryRepository } from '../../../inventory/domain/repositories/category.repository';
import { StockMovementRepository } from '../../../inventory/domain/repositories/stock-movement.repository';
import { InventoryLotService } from '../../../inventory/domain/services/inventory-lot.service';
import { ProductValidationService } from '../../../inventory/domain/services/product-validation.service';
import { ConfigService } from '@nestjs/config';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { ShopHierarchyService } from '../../../shops/domain/services/shop-hierarchy.service';
import {
  CloseStockTransferDto,
  CreateStockTransferDto,
  ReceiveStockTransferDto,
  ReceiveTransferProductSetupDto,
  ResolveStockTransferDiscrepancyDto,
  ShipStockTransferDto,
} from '../dto/stock-transfer.dto';
import {
  StockTransfer,
  StockTransferItem,
  StockTransferStatus,
} from '../../domain/entities/stock-transfer.entity';
import {
  CreateStockTransferData,
  CreateStockTransferItemData,
  StockTransferRepository,
} from '../../domain/repositories/stock-transfer.repository';
import { TransferDestinationProductService } from '../services/transfer-destination-product.service';

function toTransferResponse(transfer: StockTransfer) {
  return {
    id: transfer.id,
    reference: transfer.reference,
    sourceShopId: transfer.sourceShopId,
    destinationShopId: transfer.destinationShopId,
    sourceShopName: transfer.sourceShopName,
    destinationShopName: transfer.destinationShopName,
    status: transfer.status,
    notes: transfer.notes,
    createdBy: transfer.createdBy,
    validatedBy: transfer.validatedBy,
    shippedBy: transfer.shippedBy,
    receivedBy: transfer.receivedBy,
    closedBy: transfer.closedBy,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    validatedAt: transfer.validatedAt,
    shippedAt: transfer.shippedAt,
    receivedAt: transfer.receivedAt,
    closedAt: transfer.closedAt,
    version: transfer.version,
    transferType: transfer.transferType,
    parentTransferId: transfer.parentTransferId,
    shipments: transfer.shipments.map((s) => ({
      id: s.id,
      transferId: s.transferId,
      reference: s.reference,
      label: s.label,
      notes: s.notes,
      driverName: s.driverName,
      vehiclePlate: s.vehiclePlate,
      shippedBy: s.shippedBy,
      shippedAt: s.shippedAt,
    })),
    receipts: transfer.receipts.map((receipt) => ({
      id: receipt.id,
      transferId: receipt.transferId,
      shipmentId: receipt.shipmentId,
      reference: receipt.reference,
      notes: receipt.notes,
      receivedBy: receipt.receivedBy,
      receivedAt: receipt.receivedAt,
      items: receipt.items.map((item) => ({
        id: item.id,
        receiptId: item.receiptId,
        transferItemId: item.transferItemId,
        quantityReceived: item.quantityReceived,
        quantityRefused: item.quantityRefused ?? 0,
        refusalReason: item.refusalReason ?? null,
        refusalResolution: item.refusalResolution ?? null,
      })),
    })),
    items: transfer.items.map((item) => ({
      id: item.id,
      transferId: item.transferId,
      sourceProductId: item.sourceProductId,
      destinationProductId: item.destinationProductId,
      productServerId: item.productServerId,
      productName: item.productName,
      quantityRequested: item.quantityRequested,
      quantityShipped: item.quantityShipped,
      quantityReceived: item.quantityReceived,
      lotLines: item.lotLines.map((line) => ({
        id: line.id,
        transferItemId: line.transferItemId,
        shipmentId: line.shipmentId,
        sourceLotId: line.sourceLotId,
        destinationLotId: line.destinationLotId,
        quantity: line.quantity,
        quantityReceived: line.quantityReceived,
        unitCost: line.unitCost,
      })),
    })),
    events: transfer.events.map((event) => ({
      id: event.id,
      transferId: event.transferId,
      shopId: event.shopId,
      eventType: event.eventType,
      actorUserId: event.actorUserId,
      notes: event.notes,
      payload: event.payload,
      createdAt: event.createdAt,
    })),
    discrepancies: transfer.discrepancies.map((row) => ({
      id: row.id,
      transferId: row.transferId,
      transferItemId: row.transferItemId,
      quantity: row.quantity,
      reason: row.reason,
      resolution: row.resolution,
      notes: row.notes,
      resolvedBy: row.resolvedBy,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
    })),
  };
}

async function recordTransferEvent(
  repo: StockTransferRepository,
  data: {
    transferId: number;
    shopId: number;
    eventType: string;
    actorUserId: number;
    notes?: string | null;
    payload?: Record<string, unknown> | null;
    createdAt?: number;
  },
) {
  await repo.insertEvent({
    transferId: data.transferId,
    shopId: data.shopId,
    eventType: data.eventType,
    actorUserId: data.actorUserId,
    notes: data.notes ?? null,
    payload: data.payload ?? null,
    createdAt: data.createdAt ?? nowMs(),
  });
}

function itemOpenDiscrepancyQty(
  item: StockTransferItem,
  discrepancies: StockTransfer['discrepancies'],
): number {
  const gap = Math.max(0, item.quantityShipped - item.quantityReceived);
  const resolved = discrepancies
    .filter((row) => row.transferItemId === item.id)
    .reduce((sum, row) => sum + row.quantity, 0);
  return Math.max(0, gap - resolved);
}

async function resolveCommercialGroupShopIds(
  shops: ShopRepository,
  hierarchy: ShopHierarchyService,
  shopId: number,
): Promise<number[]> {
  const currentShop = await shops.findShopById(shopId);
  if (!currentShop?.ownerUserId) return [shopId];
  const ownedShops = await shops.findByOwnerUserId(currentShop.ownerUserId);
  return hierarchy.groupShopIds(ownedShops, shopId);
}

@Injectable()
export class ListOutgoingTransfersUseCase {
  constructor(private readonly repo: StockTransferRepository) {}

  async execute(auth: AuthContext, updatedAfter?: number) {
    const list = await this.repo.listOutgoing(auth.shopId, { updatedAfter });
    return list.map(toTransferResponse);
  }
}

@Injectable()
export class ListIncomingTransfersUseCase {
  constructor(private readonly repo: StockTransferRepository) {}

  async execute(auth: AuthContext, updatedAfter?: number) {
    const list = await this.repo.listIncoming(auth.shopId, { updatedAfter });
    return list.map(toTransferResponse);
  }
}

@Injectable()
export class GetTransferDetailsUseCase {
  constructor(private readonly repo: StockTransferRepository) {}

  async execute(auth: AuthContext, id: number) {
    const transfer = await this.repo.findById(id);
    if (!transfer) {
      throw new NotFoundException('Transfert introuvable.');
    }
    if (
      transfer.sourceShopId !== auth.shopId &&
      transfer.destinationShopId !== auth.shopId
    ) {
      throw new BadRequestException('Transfert non accessible depuis cette boutique.');
    }
    return toTransferResponse(transfer);
  }
}

@Injectable()
export class CreateTransferUseCase {
  constructor(
    private readonly repo: StockTransferRepository,
    private readonly shops: ShopRepository,
    private readonly hierarchy: ShopHierarchyService,
    private readonly products: ProductRepository,
  ) {}

  async execute(auth: AuthContext, dto: CreateStockTransferDto) {
    if (dto.destinationShopId === auth.shopId) {
      throw new BadRequestException(
        'La boutique source et la destination doivent être différentes.',
      );
    }

    await this.assertDestinationInGroup(auth.shopId, dto.destinationShopId);

    const groupIds = await resolveCommercialGroupShopIds(
      this.shops,
      this.hierarchy,
      auth.shopId,
    );
    let reference = dto.reference.trim();
    if (!reference) {
      throw new BadRequestException('Référence obligatoire.');
    }
    if (await this.repo.isReferenceUsed(groupIds, reference)) {
      reference = await this.repo.nextReference(groupIds);
      let guard = 0;
      while (
        (await this.repo.isReferenceUsed(groupIds, reference)) &&
        guard < 30
      ) {
        guard += 1;
        const next = await this.repo.nextReference(groupIds);
        // Si nextReference renvoie encore une valeur prise (course), suffixer.
        reference =
          next === reference ? `${next}-${guard}` : next;
      }
      if (await this.repo.isReferenceUsed(groupIds, reference)) {
        throw new BadRequestException(
          `La référence « ${dto.reference.trim()} » est déjà utilisée. `
            + 'Impossible d\'en générer une nouvelle automatiquement.',
        );
      }
    }

    const items: CreateStockTransferItemData[] = [];
    for (const item of dto.items) {
      const product = await this.products.findByIdAndShop(item.productId, auth.shopId);
      if (!product) {
        throw new BadRequestException(`Produit #${item.productId} introuvable.`);
      }
      if (item.quantityRequested <= 0) {
        throw new BadRequestException('Quantité invalide.');
      }
      const serverId = await this.repo.findProductServerId(item.productId, auth.shopId);
      items.push({
        sourceProductId: item.productId,
        productServerId: serverId,
        quantityRequested: item.quantityRequested,
      });
    }

    const transfer = await this.repo.createTransfer(
      auth.shopId,
      {
        reference,
        destinationShopId: dto.destinationShopId,
        notes: dto.notes ?? null,
        createdBy: auth.userId,
        transferType: dto.transferType ?? 'outbound',
        parentTransferId: dto.parentTransferId ?? null,
      },
      items,
    );

    await recordTransferEvent(this.repo, {
      transferId: transfer.id,
      shopId: auth.shopId,
      eventType: 'created',
      actorUserId: auth.userId,
      payload: { itemCount: items.length, reference: transfer.reference },
      createdAt: transfer.createdAt,
    });

    return toTransferResponse(transfer);
  }

  private async assertDestinationInGroup(
    sourceShopId: number,
    destinationShopId: number,
  ) {
    const currentShop = await this.shops.findShopById(sourceShopId);
    if (!currentShop?.ownerUserId) {
      throw new BadRequestException('Boutique source introuvable.');
    }
    const ownedShops = await this.shops.findByOwnerUserId(currentShop.ownerUserId);
    const groupIds = this.hierarchy.groupShopIds(ownedShops, sourceShopId);
    if (!groupIds.includes(destinationShopId)) {
      throw new BadRequestException(
        'La boutique destination doit appartenir à votre réseau commercial.',
      );
    }
  }
}

@Injectable()
export class ValidateTransferUseCase {
  constructor(
    private readonly repo: StockTransferRepository,
    private readonly products: ProductRepository,
    private readonly lotRepo: InventoryLotRepository,
    private readonly lots: InventoryLotService,
  ) {}

  async execute(auth: AuthContext, id: number) {
    const transfer = await this.repo.findById(id);
    if (!transfer) throw new NotFoundException('Transfert introuvable.');
    if (transfer.sourceShopId !== auth.shopId) {
      throw new BadRequestException('Validation depuis la boutique source uniquement.');
    }
    if (transfer.status !== StockTransferStatus.DRAFT) {
      throw new BadRequestException('Seul un brouillon peut être validé.');
    }

    const timestamp = nowMs();

    for (const item of transfer.items) {
      const product = await this.products.findByIdAndShop(
        item.sourceProductId,
        auth.shopId,
      );
      if (!product) {
        throw new BadRequestException(
          `Produit « ${item.productName ?? item.sourceProductId} » introuvable.`,
        );
      }

      await this.lots.ensureLotsForAllocation(auth.shopId, item.sourceProductId);

      const activeLots = await this.lotRepo.findActiveByProduct(
        auth.shopId,
        item.sourceProductId,
      );

      let remaining = item.quantityRequested;
      for (const lot of activeLots) {
        if (remaining <= 0) break;
        const available = lot.quantityRemaining - lot.quantityReserved;
        const take = Math.min(available, remaining);
        if (take <= 0) continue;

        await this.lotRepo.updateStockState(
          lot.id,
          lot.quantityRemaining,
          lot.quantityReserved + take,
          lot.status,
          lot.version,
        );

        await this.repo.insertReservation(item.id, lot.id, take, lot.unitCost);
        remaining -= take;
      }

      if (remaining > 0) {
        throw new BadRequestException(
          `Stock insuffisant pour « ${product.name} » (manque ${remaining} u).`,
        );
      }
    }

    await this.repo.updateStatus(id, StockTransferStatus.VALIDATED, {
      validated_by: auth.userId,
      validated_at: timestamp,
      version: transfer.version + 1,
    });

    await recordTransferEvent(this.repo, {
      transferId: id,
      shopId: auth.shopId,
      eventType: 'validated',
      actorUserId: auth.userId,
      createdAt: timestamp,
    });

    const updated = await this.repo.findById(id);
    return toTransferResponse(updated!);
  }
}

@Injectable()
export class SubmitTransferUseCase {
  constructor(private readonly repo: StockTransferRepository) {}

  async execute(auth: AuthContext, id: number) {
    const transfer = await this.repo.findById(id);
    if (!transfer) throw new NotFoundException('Transfert introuvable.');
    if (transfer.sourceShopId !== auth.shopId) {
      throw new BadRequestException('Soumission depuis la boutique source uniquement.');
    }
    if (transfer.status !== StockTransferStatus.DRAFT) {
      throw new BadRequestException('Seul un brouillon peut être soumis.');
    }

    const timestamp = nowMs();
    await this.repo.updateStatus(id, StockTransferStatus.PENDING_APPROVAL, {
      version: transfer.version + 1,
    });

    await recordTransferEvent(this.repo, {
      transferId: id,
      shopId: auth.shopId,
      eventType: 'submitted_for_approval',
      actorUserId: auth.userId,
      createdAt: timestamp,
    });

    const updated = await this.repo.findById(id);
    return toTransferResponse(updated!);
  }
}

@Injectable()
export class ApproveTransferUseCase {
  constructor(
    private readonly repo: StockTransferRepository,
    private readonly products: ProductRepository,
    private readonly lotRepo: InventoryLotRepository,
    private readonly lots: InventoryLotService,
  ) {}

  async execute(auth: AuthContext, id: number) {
    const transfer = await this.repo.findById(id);
    if (!transfer) throw new NotFoundException('Transfert introuvable.');
    if (transfer.sourceShopId !== auth.shopId) {
      throw new BadRequestException('Approbation depuis la boutique source uniquement.');
    }
    if (transfer.status !== StockTransferStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Seul un transfert en attente peut être approuvé.');
    }

    const timestamp = nowMs();

    for (const item of transfer.items) {
      const product = await this.products.findByIdAndShop(
        item.sourceProductId,
        auth.shopId,
      );
      if (!product) {
        throw new BadRequestException(
          `Produit « ${item.productName ?? item.sourceProductId} » introuvable.`,
        );
      }

      await this.lots.ensureLotsForAllocation(auth.shopId, item.sourceProductId);

      const activeLots = await this.lotRepo.findActiveByProduct(
        auth.shopId,
        item.sourceProductId,
      );

      let remaining = item.quantityRequested;
      for (const lot of activeLots) {
        if (remaining <= 0) break;
        const available = lot.quantityRemaining - lot.quantityReserved;
        const take = Math.min(available, remaining);
        if (take <= 0) continue;

        await this.lotRepo.updateStockState(
          lot.id,
          lot.quantityRemaining,
          lot.quantityReserved + take,
          lot.status,
          lot.version,
        );

        await this.repo.insertReservation(item.id, lot.id, take, lot.unitCost);
        remaining -= take;
      }

      if (remaining > 0) {
        throw new BadRequestException(
          `Stock insuffisant pour « ${product.name} » (manque ${remaining} u).`,
        );
      }
    }

    await this.repo.updateStatus(id, StockTransferStatus.VALIDATED, {
      validated_by: auth.userId,
      validated_at: timestamp,
      version: transfer.version + 1,
    });

    await recordTransferEvent(this.repo, {
      transferId: id,
      shopId: auth.shopId,
      eventType: 'validated',
      actorUserId: auth.userId,
      notes: 'Approbation manager',
      createdAt: timestamp,
    });

    const updated = await this.repo.findById(id);
    return toTransferResponse(updated!);
  }
}

@Injectable()
export class ShipTransferUseCase {
  constructor(
    private readonly repo: StockTransferRepository,
    private readonly products: ProductRepository,
    private readonly lotRepo: InventoryLotRepository,
    private readonly stockMovements: StockMovementRepository,
    private readonly destinationProducts: TransferDestinationProductService,
  ) {}

  async execute(auth: AuthContext, id: number, dto: ShipStockTransferDto) {
    const transfer = await this.repo.findById(id);
    if (!transfer) {
      throw new NotFoundException('Transfert introuvable.');
    }
    if (transfer.sourceShopId !== auth.shopId) {
      throw new BadRequestException('Expédition depuis la boutique source uniquement.');
    }
    if (
      transfer.status !== StockTransferStatus.VALIDATED &&
      transfer.status !== StockTransferStatus.PARTIALLY_SHIPPED
    ) {
      throw new BadRequestException('Ce transfert ne peut pas être expédié.');
    }

    const timestamp = nowMs();
    const quantities = new Map(dto.items.map((i) => [i.itemId, i.quantity]));
    const existingShipments = await this.repo.listShipments(id);
    const seq = existingShipments.length + 1;
    const safeRef = transfer.reference.replace(/\s+/g, '-');
    const shipmentReference = `SHP-${safeRef}-${seq}`;
    const shipmentId = await this.repo.createShipment(id, {
      reference: shipmentReference,
      label: dto.label.trim() || 'Expédition',
      notes: dto.notes ?? null,
      driverName: dto.driverName?.trim() || null,
      vehiclePlate: dto.vehiclePlate?.trim() || null,
      shippedBy: auth.userId,
      shippedAt: timestamp,
    });

    let anyShipped = false;

    for (const item of transfer.items) {
      const qtyToShip = quantities.get(item.id);
      if (qtyToShip == null || qtyToShip <= 0) continue;

      const pending = item.quantityRequested - item.quantityShipped;
      if (qtyToShip > pending) {
        throw new BadRequestException(
          `Quantité expédiée trop élevée pour « ${item.productName ?? item.sourceProductId} ».`,
        );
      }

      const product = await this.products.findByIdAndShop(
        item.sourceProductId,
        auth.shopId,
      );
      if (!product) {
        throw new BadRequestException(
          `Produit « ${item.productName ?? item.sourceProductId} » introuvable.`,
        );
      }

      const reservations = await this.repo.listReservationsByItem(item.id);
      const lotIds = reservations.map((r) => r.lotId);
      const lots = await Promise.all(lotIds.map((lotId) => this.lotRepo.findById(lotId)));
      const lotsById = new Map(
        lots.filter(Boolean).map((lot) => [lot!.id, lot!]),
      );

      reservations.sort((a, b) => {
        const lotA = lotsById.get(a.lotId);
        const lotB = lotsById.get(b.lotId);
        const cmp = (lotA?.receivedAt ?? 0) - (lotB?.receivedAt ?? 0);
        return cmp !== 0 ? cmp : a.lotId - b.lotId;
      });

      let remaining = qtyToShip;
      const slices: { sourceLotId: number; quantity: number; unitCost: number }[] = [];

      for (const reservation of reservations) {
        if (remaining <= 0) break;
        const reservationPending = reservation.quantity - reservation.quantityShipped;
        if (reservationPending <= 0) continue;

        const take = Math.min(reservationPending, remaining);
        const lot = lotsById.get(reservation.lotId);
        if (!lot) {
          throw new BadRequestException(`Lot #${reservation.lotId} introuvable.`);
        }

        const newRemaining = lot.quantityRemaining - take;
        const newReserved = lot.quantityReserved - take;

        await this.lotRepo.updateStockState(
          lot.id,
          newRemaining,
          newReserved,
          newRemaining <= 0 ? InventoryLotStatus.DEPLETED : InventoryLotStatus.ACTIVE,
          lot.version,
        );

        await this.repo.updateReservationShipped(
          reservation.id,
          reservation.quantityShipped + take,
        );

        slices.push({
          sourceLotId: lot.id,
          quantity: take,
          unitCost: reservation.unitCost,
        });
        remaining -= take;
      }

      if (remaining > 0) {
        throw new BadRequestException(
          `Réservations insuffisantes pour « ${item.productName ?? item.sourceProductId} ».`,
        );
      }

      await this.repo.insertLotLines(
        item.id,
        slices.map((slice) => ({ ...slice, shipmentId })),
      );

      const qtyBefore = product.quantityInStock;
      await this.repo.incrementItemShipped(item.id, qtyToShip);

      const refreshed = await this.products.findByIdAndShop(
        item.sourceProductId,
        auth.shopId,
      );
      const qtyAfter = refreshed?.quantityInStock ?? qtyBefore - qtyToShip;

      await this.stockMovements.create({
        shop_id: auth.shopId,
        product_id: item.sourceProductId,
        user_id: auth.userId,
        type: 'transfer_out',
        quantity_change: -qtyToShip,
        quantity_before: qtyBefore,
        quantity_after: qtyAfter,
        reason: `Transfert ${transfer.reference} · ${dto.label}`,
        unit_cost: slices.length > 0 ? slices[0].unitCost : null,
        created_at: timestamp,
      });

      const destProductId = await this.destinationProducts.ensureDestinationProduct(
        transfer.destinationShopId,
        transfer,
        item,
      );
      if (destProductId != null) {
        await this.repo.updateItemDestinationProduct(item.id, destProductId);
      }

      anyShipped = true;
    }

    if (!anyShipped) {
      throw new BadRequestException('Aucune quantité à expédier.');
    }

    const refreshedTransfer = await this.repo.findById(id);
    const fullyShipped = (refreshedTransfer?.items ?? []).every(
      (it) => it.quantityShipped >= it.quantityRequested,
    );

    await this.repo.updateStatus(
      id,
      fullyShipped ? StockTransferStatus.SHIPPED : StockTransferStatus.PARTIALLY_SHIPPED,
      {
        shipped_by: auth.userId,
        shipped_at: timestamp,
        version: (refreshedTransfer?.version ?? transfer.version) + 1,
      },
    );

    await recordTransferEvent(this.repo, {
      transferId: id,
      shopId: auth.shopId,
      eventType: 'shipped',
      actorUserId: auth.userId,
      notes: dto.notes ?? null,
      payload: {
        shipmentId,
        reference: shipmentReference,
        label: dto.label.trim() || 'Expédition',
      },
      createdAt: timestamp,
    });

    const updated = await this.repo.findById(id);
    return toTransferResponse(updated!);
  }
}

@Injectable()
export class ListInTransitTransfersUseCase {
  constructor(private readonly repo: StockTransferRepository) {}

  async execute(auth: AuthContext, updatedAfter?: number) {
    const list = await this.repo.listInTransit(auth.shopId, { updatedAfter });
    return list.map(toTransferResponse);
  }
}

@Injectable()
export class ReceiveTransferUseCase {
  constructor(
    private readonly repo: StockTransferRepository,
    private readonly products: ProductRepository,
    private readonly lots: InventoryLotService,
    private readonly lotRepo: InventoryLotRepository,
    private readonly stockMovements: StockMovementRepository,
    private readonly destinationProducts: TransferDestinationProductService,
  ) {}

  async execute(auth: AuthContext, id: number, dto: ReceiveStockTransferDto) {
    const transfer = await this.repo.findById(id);
    if (!transfer) {
      throw new NotFoundException('Transfert introuvable.');
    }
    if (transfer.destinationShopId !== auth.shopId) {
      throw new BadRequestException(
        'Réception depuis la boutique destination uniquement.',
      );
    }
    if (
      transfer.status !== StockTransferStatus.SHIPPED &&
      transfer.status !== StockTransferStatus.PARTIALLY_SHIPPED &&
      transfer.status !== StockTransferStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException('Ce transfert ne peut pas être réceptionné.');
    }

    const timestamp = nowMs();
    const itemPayload = new Map(dto.items.map((item) => [item.itemId, item]));
    const productSetups = new Map(
      dto.items
        .filter((item) => item.productSetup != null)
        .map((item) => [item.itemId, item.productSetup!]),
    );

    if (dto.shipmentId != null) {
      const shipment = transfer.shipments.find((s) => s.id === dto.shipmentId);
      if (!shipment) {
        throw new BadRequestException('Expédition introuvable.');
      }
    }

    const receiptItems = dto.items.filter(
      (item) => item.quantityReceived > 0 || (item.quantityRefused ?? 0) > 0,
    );
    if (receiptItems.length === 0) {
      throw new BadRequestException('Aucune quantité à traiter.');
    }

    const seq = (await this.repo.countReceipts(id)) + 1;
    const safeRef = transfer.reference.replace(/\s+/g, '-');
    const receiptReference = `RCP-${safeRef}-${seq}`;
    const receiptId = await this.repo.createReceipt({
      transferId: id,
      shipmentId: dto.shipmentId ?? null,
      reference: receiptReference,
      notes: dto.notes ?? null,
      receivedBy: auth.userId,
      receivedAt: timestamp,
      createdAt: timestamp,
    });

    for (const item of transfer.items) {
      const payload = itemPayload.get(item.id);
      if (payload == null) continue;

      const toReceive = payload.quantityReceived ?? 0;
      const toRefuse = payload.quantityRefused ?? 0;
      if (toReceive <= 0 && toRefuse <= 0) continue;

      const pending = dto.shipmentId
        ? item.lotLines
            .filter((line) => line.shipmentId === dto.shipmentId)
            .reduce(
              (sum, line) => sum + (line.quantity - line.quantityReceived),
              0,
            )
        : item.quantityShipped - item.quantityReceived;
      if (toReceive + toRefuse > pending) {
        // Retry idempotent : déjà entièrement reçu → ignorer la ligne.
        if (pending <= 0) continue;
        throw new BadRequestException(
          `Quantités reçues/refusées trop élevées pour « ${item.productName ?? item.sourceProductId} ».`,
        );
      }
      if (toRefuse > 0 && (!payload.refusalReason || !payload.refusalResolution)) {
        throw new BadRequestException(
          `Motif et résolution requis pour le refus de « ${item.productName ?? item.sourceProductId} ».`,
        );
      }

      let destProductId: number | null = null;
      if (toReceive > 0) {
        const setup = productSetups.get(item.id);
        // Toujours résoudre via catalogue (nom / serverId / sku) avant le lien stocké,
        // pour ne pas coller à un doublon créé par un transfert précédent.
        destProductId = await this.destinationProducts.resolveExistingDestinationProduct(
          auth.shopId,
          transfer,
          item,
          setup,
        );
        if (destProductId == null) {
          destProductId = await this.destinationProducts.ensureDestinationProduct(
            auth.shopId,
            transfer,
            item,
            setup,
          );
        }
        if (destProductId == null) {
          throw new BadRequestException(
            `Produit « ${item.productName ?? item.sourceProductId} » introuvable dans la boutique destination.`,
          );
        }

        const productBefore =
          (await this.products.findByIdAndShop(destProductId, auth.shopId))
            ?.quantityInStock ?? 0;

        let remaining = toReceive;
        for (const line of item.lotLines) {
          if (remaining <= 0) break;
          if (dto.shipmentId != null && line.shipmentId !== dto.shipmentId) {
            continue;
          }
          const linePending = line.quantity - line.quantityReceived;
          if (linePending <= 0) continue;

          const take = Math.min(linePending, remaining);
          const sourceLot = await this.lotRepo.findById(line.sourceLotId);

          const destLot = await this.lots.createLot({
            shopId: auth.shopId,
            productId: destProductId,
            sourceType: InventoryLotSourceType.STOCK_TRANSFER_IN,
            sourceId: transfer.id,
            unitCost: line.unitCost,
            quantity: take,
            batchNumber: sourceLot?.batchNumber ?? null,
            expiryDate: sourceLot?.expiryDate ?? null,
            receivedAt: timestamp,
          });

          await this.repo.updateLotLineReceived(
            line.id,
            line.quantityReceived + take,
            destLot.id,
          );

          remaining -= take;
        }

        if (remaining > 0) {
          throw new BadRequestException(
            `Lignes de lots insuffisantes pour « ${item.productName} ».`,
          );
        }

        const newReceived = item.quantityReceived + toReceive;
        await this.repo.updateItemReceived(item.id, newReceived, destProductId);

        const refreshed = await this.products.findByIdAndShop(destProductId, auth.shopId);
        const qtyAfter = refreshed?.quantityInStock ?? productBefore + toReceive;

        await this.stockMovements.create({
          shop_id: auth.shopId,
          product_id: destProductId,
          user_id: auth.userId,
          type: 'transfer_in',
          quantity_change: toReceive,
          quantity_before: productBefore,
          quantity_after: qtyAfter,
          reason: `Transfert ${transfer.reference} · ${receiptReference}${
            dto.shipmentId
              ? ` · ${
                  transfer.shipments.find((s) => s.id === dto.shipmentId)
                    ?.reference ?? 'expédition'
                }`
              : ''
          }`,
          unit_cost: item.lotLines.length > 0 ? item.lotLines[0].unitCost : null,
          created_at: timestamp,
        });
      }

      await this.repo.insertReceiptItem({
        receiptId,
        transferItemId: item.id,
        quantityReceived: toReceive,
        quantityRefused: toRefuse,
        refusalReason: payload.refusalReason ?? null,
        refusalResolution: payload.refusalResolution ?? null,
        createdAt: timestamp,
      });

      if (toRefuse > 0) {
        await recordTransferEvent(this.repo, {
          transferId: id,
          shopId: auth.shopId,
          eventType: 'refused',
          actorUserId: auth.userId,
          payload: {
            itemId: item.id,
            quantity: toRefuse,
            reason: payload.refusalReason,
            resolution: payload.refusalResolution,
          },
          createdAt: timestamp,
        });
      }
    }

    const refreshedTransfer = await this.repo.findById(id);
    const items = refreshedTransfer?.items ?? [];
    let complete = true;
    let partial = false;
    for (const it of items) {
      if (it.quantityReceived < it.quantityShipped) {
        complete = false;
        if (it.quantityReceived > 0) partial = true;
      }
    }

    const nextStatus = complete
      ? StockTransferStatus.RECEIVED
      : partial
        ? StockTransferStatus.PARTIALLY_RECEIVED
        : StockTransferStatus.SHIPPED;

    await this.repo.updateStatus(id, nextStatus, {
      received_by: auth.userId,
      received_at: timestamp,
      version: (refreshedTransfer?.version ?? transfer.version) + 1,
    });

    await recordTransferEvent(this.repo, {
      transferId: id,
      shopId: auth.shopId,
      eventType: 'received',
      actorUserId: auth.userId,
      notes: dto.notes ?? null,
      payload: {
        receiptId,
        reference: receiptReference,
        shipmentId: dto.shipmentId ?? null,
        itemCount: receiptItems.length,
      },
      createdAt: timestamp,
    });

    const updated = await this.repo.findById(id);
    return toTransferResponse(updated!);
  }
}

@Injectable()
export class CancelTransferUseCase {
  constructor(
    private readonly repo: StockTransferRepository,
    private readonly products: ProductRepository,
    private readonly lotRepo: InventoryLotRepository,
    private readonly lots: InventoryLotService,
    private readonly stockMovements: StockMovementRepository,
  ) {}

  async execute(auth: AuthContext, id: number) {
    const transfer = await this.repo.findById(id);
    if (!transfer) {
      throw new NotFoundException('Transfert introuvable.');
    }
    if (transfer.sourceShopId !== auth.shopId) {
      throw new BadRequestException('Annulation depuis la boutique source uniquement.');
    }

    const timestamp = nowMs();

    if (
      transfer.status === StockTransferStatus.DRAFT ||
      transfer.status === StockTransferStatus.PENDING_APPROVAL ||
      transfer.status === StockTransferStatus.VALIDATED
    ) {
      if (transfer.status === StockTransferStatus.VALIDATED) {
        for (const item of transfer.items) {
          await this.releaseReservations(item.id);
        }
      }

      await this.repo.updateStatus(id, StockTransferStatus.CANCELLED, {
        version: transfer.version + 1,
      });
      await recordTransferEvent(this.repo, {
        transferId: id,
        shopId: auth.shopId,
        eventType: 'cancelled',
        actorUserId: auth.userId,
        createdAt: timestamp,
      });
      return { success: true };
    }

    if (
      transfer.status === StockTransferStatus.PARTIALLY_SHIPPED ||
      transfer.status === StockTransferStatus.SHIPPED
    ) {
      throw new BadRequestException(
        'Utilisez la clôture avec résolution d\'écart plutôt que l\'annulation.',
      );
    }

    throw new BadRequestException('Ce transfert ne peut pas être annulé.');
  }

  private async releaseReservations(transferItemId: number) {
    const reservations = await this.repo.listReservationsByItem(transferItemId);
    for (const reservation of reservations) {
      const unshipped = reservation.quantity - reservation.quantityShipped;
      if (unshipped <= 0) continue;

      const lot = await this.lotRepo.findById(reservation.lotId);
      if (!lot) continue;

      await this.lotRepo.updateStockState(
        lot.id,
        lot.quantityRemaining,
        Math.max(0, lot.quantityReserved - unshipped),
        lot.status,
        lot.version,
      );
    }
    await this.repo.deleteReservationsByItem(transferItemId);
  }
}

@Injectable()
export class CreateReturnTransferUseCase {
  constructor(
    private readonly repo: StockTransferRepository,
    private readonly products: ProductRepository,
    private readonly shops: ShopRepository,
    private readonly hierarchy: ShopHierarchyService,
  ) {}

  async execute(auth: AuthContext, parentId: number) {
    const parent = await this.repo.findById(parentId);
    if (!parent) {
      throw new NotFoundException('Transfert d\'origine introuvable.');
    }
    if (parent.destinationShopId !== auth.shopId) {
      throw new BadRequestException(
        'Le retour doit être créé depuis la boutique destination.',
      );
    }
    if (
      parent.status !== StockTransferStatus.RECEIVED &&
      parent.status !== StockTransferStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException(
        'Seul un transfert reçu peut faire l\'objet d\'un retour.',
      );
    }
    if ((parent.transferType ?? 'outbound') !== 'outbound') {
      throw new BadRequestException('Impossible de retourner un retour.');
    }

    const suffix = parent.reference.replace(/^(TRF|RET)-/, '');
    let reference = `RET-${suffix}`;
    const groupIds = await resolveCommercialGroupShopIds(
      this.shops,
      this.hierarchy,
      auth.shopId,
    );
    if (await this.repo.isReferenceUsed(groupIds, reference)) {
      reference = await this.repo.nextReference(groupIds);
      reference = reference.replace(/^TRF-/i, 'RET-');
      let guard = 0;
      while (
        (await this.repo.isReferenceUsed(groupIds, reference)) &&
        guard < 30
      ) {
        guard += 1;
        const next = (await this.repo.nextReference(groupIds)).replace(
          /^TRF-/i,
          'RET-',
        );
        reference = next === reference ? `${next}-${guard}` : next;
      }
    }
    const items: CreateStockTransferItemData[] = [];

    for (const item of parent.items) {
      if (item.quantityReceived <= 0) continue;
      const productId = item.destinationProductId ?? item.sourceProductId;
      const product = await this.products.findByIdAndShop(productId, auth.shopId);
      if (!product) {
        throw new BadRequestException(
          `Produit « ${item.productName ?? productId} » introuvable.`,
        );
      }
      items.push({
        sourceProductId: productId,
        productServerId: item.productServerId,
        quantityRequested: item.quantityReceived,
      });
    }

    if (items.length === 0) {
      throw new BadRequestException('Aucun article reçu disponible pour un retour.');
    }

    const transfer = await this.repo.createTransfer(
      auth.shopId,
      {
        reference,
        destinationShopId: parent.sourceShopId,
        notes: `Retour de ${parent.reference}`,
        createdBy: auth.userId,
        transferType: 'return',
        parentTransferId: parent.id,
      },
      items,
    );

    return toTransferResponse(transfer);
  }
}

@Injectable()
export class ResolveTransferDiscrepancyUseCase {
  constructor(
    private readonly repo: StockTransferRepository,
    private readonly products: ProductRepository,
    private readonly lotRepo: InventoryLotRepository,
    private readonly lots: InventoryLotService,
    private readonly stockMovements: StockMovementRepository,
  ) {}

  async execute(
    auth: AuthContext,
    id: number,
    dto: ResolveStockTransferDiscrepancyDto,
  ) {
    const transfer = await this.repo.findById(id);
    if (!transfer) {
      throw new NotFoundException('Transfert introuvable.');
    }
    if (transfer.sourceShopId !== auth.shopId) {
      throw new BadRequestException(
        'Résolution d\'écart depuis la boutique source uniquement.',
      );
    }
    if (
      transfer.status === StockTransferStatus.DRAFT ||
      transfer.status === StockTransferStatus.VALIDATED ||
      transfer.status === StockTransferStatus.CANCELLED ||
      transfer.status === StockTransferStatus.CLOSED ||
      transfer.status === StockTransferStatus.CLOSED_WITH_EXCEPTION
    ) {
      throw new BadRequestException('Ce transfert ne peut pas recevoir de résolution d\'écart.');
    }

    const item = transfer.items.find((row) => row.id === dto.itemId);
    if (!item) {
      throw new BadRequestException('Article introuvable sur ce transfert.');
    }

    const openQty = itemOpenDiscrepancyQty(item, transfer.discrepancies);
    if (dto.quantity > openQty) {
      throw new BadRequestException(
        `Quantité d'écart trop élevée (max ${openQty}).`,
      );
    }

    const timestamp = nowMs();

    if (dto.resolution === 'restock_source') {
      await this.restockUnreceivedLots(
        auth,
        transfer,
        item,
        dto.quantity,
        timestamp,
      );
    }

    await this.repo.insertDiscrepancy({
      transferId: id,
      transferItemId: item.id,
      quantity: dto.quantity,
      reason: dto.reason,
      resolution: dto.resolution,
      notes: dto.notes ?? null,
      resolvedBy: auth.userId,
      resolvedAt: timestamp,
      createdAt: timestamp,
    });

    await recordTransferEvent(this.repo, {
      transferId: id,
      shopId: auth.shopId,
      eventType: 'discrepancy_resolved',
      actorUserId: auth.userId,
      notes: dto.notes ?? null,
      payload: {
        itemId: item.id,
        quantity: dto.quantity,
        reason: dto.reason,
        resolution: dto.resolution,
        productName: item.productName,
      },
      createdAt: timestamp,
    });

    const updated = await this.repo.findById(id);
    return toTransferResponse(updated!);
  }

  private async restockUnreceivedLots(
    auth: AuthContext,
    transfer: StockTransfer,
    item: StockTransferItem,
    quantity: number,
    timestamp: number,
  ) {
    const product = await this.products.findByIdAndShop(
      item.sourceProductId,
      auth.shopId,
    );
    if (!product) {
      throw new BadRequestException(
        `Produit « ${item.productName ?? item.sourceProductId} » introuvable.`,
      );
    }

    let remaining = quantity;
    for (const line of item.lotLines) {
      if (remaining <= 0) break;
      if (line.quantityReceived > 0) continue;

      const take = Math.min(remaining, line.quantity);
      const lot = await this.lotRepo.findById(line.sourceLotId);
      if (!lot) continue;

      const newRemaining = lot.quantityRemaining + take;
      await this.lotRepo.updateStockState(
        lot.id,
        newRemaining,
        lot.quantityReserved,
        newRemaining > 0 ? InventoryLotStatus.ACTIVE : lot.status,
        lot.version,
      );
      remaining -= take;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        'Impossible de restocker la quantité demandée (lots insuffisants).',
      );
    }

    await this.lots.refreshProductStockFromLots(auth.shopId, item.sourceProductId);
    const refreshed = await this.products.findByIdAndShop(
      item.sourceProductId,
      auth.shopId,
    );

    await this.stockMovements.create({
      shop_id: auth.shopId,
      product_id: item.sourceProductId,
      user_id: auth.userId,
      type: 'transfer_in',
      quantity_change: quantity,
      quantity_before: product.quantityInStock,
      quantity_after: refreshed?.quantityInStock ?? product.quantityInStock + quantity,
      reason: `Écart transfert ${transfer.reference} · restock source`,
      unit_cost: item.lotLines.length > 0 ? item.lotLines[0].unitCost : null,
      created_at: timestamp,
    });
  }
}

@Injectable()
export class CloseTransferUseCase {
  constructor(private readonly repo: StockTransferRepository) {}

  async execute(auth: AuthContext, id: number, dto: CloseStockTransferDto) {
    const transfer = await this.repo.findById(id);
    if (!transfer) {
      throw new NotFoundException('Transfert introuvable.');
    }
    if (transfer.sourceShopId !== auth.shopId) {
      throw new BadRequestException('Clôture depuis la boutique source uniquement.');
    }

    const closable = new Set<string>([
      StockTransferStatus.PARTIALLY_SHIPPED,
      StockTransferStatus.SHIPPED,
      StockTransferStatus.PARTIALLY_RECEIVED,
      StockTransferStatus.RECEIVED,
    ]);
    if (!closable.has(transfer.status)) {
      throw new BadRequestException('Ce transfert ne peut pas être clôturé.');
    }

    const timestamp = nowMs();
    let hasUnresolved = false;
    for (const item of transfer.items) {
      if (itemOpenDiscrepancyQty(item, transfer.discrepancies) > 0) {
        hasUnresolved = true;
        break;
      }
    }

    const nextStatus = hasUnresolved
      ? StockTransferStatus.CLOSED_WITH_EXCEPTION
      : StockTransferStatus.CLOSED;

    await this.repo.updateStatus(id, nextStatus, {
      closed_by: auth.userId,
      closed_at: timestamp,
      version: transfer.version + 1,
    });

    await recordTransferEvent(this.repo, {
      transferId: id,
      shopId: auth.shopId,
      eventType: hasUnresolved ? 'closed_with_exception' : 'closed',
      actorUserId: auth.userId,
      notes: dto.notes ?? null,
      payload: { hasUnresolved },
      createdAt: timestamp,
    });

    const updated = await this.repo.findById(id);
    return toTransferResponse(updated!);
  }
}

@Injectable()
export class NextTransferReferenceUseCase {
  constructor(
    private readonly repo: StockTransferRepository,
    private readonly shops: ShopRepository,
    private readonly hierarchy: ShopHierarchyService,
  ) {}

  async execute(auth: AuthContext) {
    const groupIds = await resolveCommercialGroupShopIds(
      this.shops,
      this.hierarchy,
      auth.shopId,
    );
    return this.repo.nextReference(groupIds);
  }
}
