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
  CreateStockTransferDto,
  ReceiveStockTransferDto,
  ReceiveTransferProductSetupDto,
  ShipStockTransferDto,
} from '../dto/stock-transfer.dto';
import {
  StockTransfer,
  StockTransferStatus,
} from '../../domain/entities/stock-transfer.entity';
import {
  CreateStockTransferData,
  CreateStockTransferItemData,
  StockTransferRepository,
} from '../../domain/repositories/stock-transfer.repository';

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
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    validatedAt: transfer.validatedAt,
    shippedAt: transfer.shippedAt,
    receivedAt: transfer.receivedAt,
    version: transfer.version,
    transferType: transfer.transferType,
    parentTransferId: transfer.parentTransferId,
    shipments: transfer.shipments.map((s) => ({
      id: s.id,
      transferId: s.transferId,
      label: s.label,
      notes: s.notes,
      shippedBy: s.shippedBy,
      shippedAt: s.shippedAt,
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
  };
}

@Injectable()
export class ListOutgoingTransfersUseCase {
  constructor(private readonly repo: StockTransferRepository) {}

  async execute(auth: AuthContext) {
    const list = await this.repo.listOutgoing(auth.shopId);
    return list.map(toTransferResponse);
  }
}

@Injectable()
export class ListIncomingTransfersUseCase {
  constructor(private readonly repo: StockTransferRepository) {}

  async execute(auth: AuthContext) {
    const list = await this.repo.listIncoming(auth.shopId);
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
        reference: dto.reference.trim(),
        destinationShopId: dto.destinationShopId,
        notes: dto.notes ?? null,
        createdBy: auth.userId,
        transferType: dto.transferType ?? 'outbound',
        parentTransferId: dto.parentTransferId ?? null,
      },
      items,
    );

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
    const shipmentId = await this.repo.createShipment(id, {
      label: dto.label.trim() || 'Expédition',
      notes: dto.notes ?? null,
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

    const updated = await this.repo.findById(id);
    return toTransferResponse(updated!);
  }
}

@Injectable()
export class ReceiveTransferUseCase {
  private static readonly importCategoryName = 'Transferts inter-boutiques';

  constructor(
    private readonly repo: StockTransferRepository,
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly lots: InventoryLotService,
    private readonly lotRepo: InventoryLotRepository,
    private readonly stockMovements: StockMovementRepository,
    private readonly validation: ProductValidationService,
    private readonly configService: ConfigService,
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
    const quantities = new Map(dto.items.map((i) => [i.itemId, i.quantityReceived]));
    const productSetups = new Map(
      dto.items
        .filter((item) => item.productSetup != null)
        .map((item) => [item.itemId, item.productSetup!]),
    );

    for (const item of transfer.items) {
      const toReceive = quantities.get(item.id);
      if (toReceive == null || toReceive <= 0) continue;

      const pending = item.quantityShipped - item.quantityReceived;
      if (toReceive > pending) {
        throw new BadRequestException(
          `Quantité reçue trop élevée pour « ${item.productName ?? item.sourceProductId} ».`,
        );
      }

      let destProductId = item.destinationProductId;
      if (destProductId == null && item.productServerId) {
        destProductId = await this.repo.findProductIdByServerId(
          auth.shopId,
          item.productServerId,
        );
      }
      if (destProductId == null) {
        const setup = productSetups.get(item.id);
        if (setup) {
          destProductId = await this.createDestinationProduct(auth, setup);
        }
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
        reason: `Transfert ${transfer.reference}`,
        unit_cost: item.lotLines.length > 0 ? item.lotLines[0].unitCost : null,
        created_at: timestamp,
      });
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

    const updated = await this.repo.findById(id);
    return toTransferResponse(updated!);
  }

  private async resolveImportCategoryId(shopId: number): Promise<number> {
    const categories = await this.categories.findAllByShop(shopId, true);
    const existing = categories.find(
      (category) => category.name === ReceiveTransferUseCase.importCategoryName,
    );
    if (existing) return existing.id;
    if (categories.length > 0) return categories[0].id;

    const timestamp = nowMs();
    const created = await this.categories.create({
      shop_id: shopId,
      name: ReceiveTransferUseCase.importCategoryName,
      description: 'Produits créés à la réception d\'un transfert',
      sort_order: 999,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return created.id;
  }

  private async createDestinationProduct(
    auth: AuthContext,
    setup: ReceiveTransferProductSetupDto,
  ): Promise<number> {
    this.validation.validateName(setup.name);
    this.validation.validatePrices({
      priceSell: setup.priceSell,
      priceBuy: setup.priceBuy,
    });

    const categoryId = await this.resolveImportCategoryId(auth.shopId);
    const defaultThreshold = this.configService.get<number>(
      'dashboard.defaultAlertThreshold',
      5,
    );
    const timestamp = nowMs();

    const product = await this.products.create({
      shop_id: auth.shopId,
      category_id: categoryId,
      name: setup.name.trim(),
      quantity_in_stock: 0,
      alert_threshold: defaultThreshold,
      price_buy: setup.priceBuy ?? null,
      price_sell: setup.priceSell,
      created_at: timestamp,
      updated_at: timestamp,
    });

    if (setup.productServerId?.trim()) {
      await this.products.updateInShop(product.id, auth.shopId, {
        server_id: setup.productServerId.trim(),
      });
    }

    return product.id;
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
      return { success: true };
    }

    if (
      transfer.status === StockTransferStatus.PARTIALLY_SHIPPED ||
      transfer.status === StockTransferStatus.SHIPPED
    ) {
      const totalReceived = transfer.items.reduce(
        (sum, item) => sum + item.quantityReceived,
        0,
      );
      if (totalReceived > 0) {
        throw new BadRequestException(
          'Impossible d\'annuler un transfert déjà partiellement reçu.',
        );
      }

      for (const item of transfer.items) {
        await this.releaseReservations(item.id);

        const product = await this.products.findByIdAndShop(
          item.sourceProductId,
          auth.shopId,
        );
        if (!product) continue;

        let restockQty = 0;
        for (const line of item.lotLines) {
          if (line.quantityReceived > 0) continue;
          restockQty += line.quantity;

          const lot = await this.lotRepo.findById(line.sourceLotId);
          if (!lot) continue;

          const newRemaining = lot.quantityRemaining + line.quantity;
          await this.lotRepo.updateStockState(
            lot.id,
            newRemaining,
            lot.quantityReserved,
            newRemaining > 0 ? InventoryLotStatus.ACTIVE : lot.status,
            lot.version,
          );
        }

        if (restockQty <= 0) continue;

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
          quantity_change: restockQty,
          quantity_before: product.quantityInStock,
          quantity_after: refreshed?.quantityInStock ?? product.quantityInStock + restockQty,
          reason: `Annulation ${transfer.reference}`,
          unit_cost: null,
          created_at: timestamp,
        });
      }

      await this.repo.updateStatus(id, StockTransferStatus.CANCELLED, {
        version: transfer.version + 1,
      });
      return { success: true };
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
    const reference = `RET-${suffix}`;
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
export class NextTransferReferenceUseCase {
  constructor(private readonly repo: StockTransferRepository) {}

  execute(auth: AuthContext) {
    return this.repo.nextReference(auth.shopId);
  }
}
