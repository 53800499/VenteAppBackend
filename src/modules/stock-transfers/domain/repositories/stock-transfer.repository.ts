import {
  StockTransfer,
  StockTransferLotLine,
  StockTransferStatusValue,
} from '../entities/stock-transfer.entity';

export type CreateStockTransferItemData = {
  sourceProductId: number;
  productServerId?: string | null;
  quantityRequested: number;
};

export type CreateStockTransferData = {
  reference: string;
  destinationShopId: number;
  notes?: string | null;
  createdBy: number;
  transferType?: string;
  parentTransferId?: number | null;
};

export type ReceiveStockTransferItemData = {
  itemId: number;
  quantityReceived: number;
};

export type ShipStockTransferItemData = {
  itemId: number;
  quantity: number;
};

export abstract class StockTransferRepository {
  abstract listOutgoing(sourceShopId: number): Promise<StockTransfer[]>;

  abstract listIncoming(destinationShopId: number): Promise<StockTransfer[]>;

  abstract findById(id: number): Promise<StockTransfer | null>;

  abstract createTransfer(
    sourceShopId: number,
    data: CreateStockTransferData,
    items: CreateStockTransferItemData[],
  ): Promise<StockTransfer>;

  abstract updateStatus(
    id: number,
    status: StockTransferStatusValue,
    patch: Record<string, unknown>,
  ): Promise<void>;

  abstract insertLotLines(
    transferItemId: number,
    lines: {
      sourceLotId: number;
      quantity: number;
      unitCost: number;
      shipmentId?: number | null;
    }[],
  ): Promise<StockTransferLotLine[]>;

  abstract createShipment(
    transferId: number,
    data: {
      reference: string;
      label: string;
      notes?: string | null;
      driverName?: string | null;
      vehiclePlate?: string | null;
      shippedBy: number;
      shippedAt: number;
    },
  ): Promise<number>;

  abstract insertReservation(
    transferItemId: number,
    lotId: number,
    quantity: number,
    unitCost: number,
  ): Promise<void>;

  abstract listReservationsByItem(
    transferItemId: number,
  ): Promise<
    {
      id: number;
      lotId: number;
      quantity: number;
      quantityShipped: number;
      unitCost: number;
    }[]
  >;

  abstract updateReservationShipped(
    reservationId: number,
    quantityShipped: number,
  ): Promise<void>;

  abstract deleteReservationsByItem(transferItemId: number): Promise<void>;

  abstract incrementItemShipped(itemId: number, delta: number): Promise<void>;

  abstract listShipments(transferId: number): Promise<
    {
      id: number;
      transferId: number;
      reference: string;
      label: string;
      notes: string | null;
      driverName: string | null;
      vehiclePlate: string | null;
      shippedBy: number;
      shippedAt: number;
    }[]
  >;

  abstract updateItemShipped(
    itemId: number,
    quantityShipped: number,
  ): Promise<void>;

  abstract updateItemReceived(
    itemId: number,
    quantityReceived: number,
    destinationProductId?: number | null,
  ): Promise<void>;

  abstract updateLotLineReceived(
    lotLineId: number,
    quantityReceived: number,
    destinationLotId: number,
  ): Promise<void>;

  abstract nextReference(sourceShopId: number): Promise<string>;

  abstract findProductServerId(productId: number, shopId: number): Promise<string | null>;

  abstract findProductIdByServerId(
    shopId: number,
    serverId: string,
  ): Promise<number | null>;

  abstract insertEvent(data: {
    transferId: number;
    shopId: number;
    eventType: string;
    actorUserId: number;
    notes?: string | null;
    payload?: Record<string, unknown> | null;
    createdAt: number;
  }): Promise<number>;

  abstract listEvents(transferId: number): Promise<
    {
      id: number;
      transferId: number;
      shopId: number;
      eventType: string;
      actorUserId: number;
      notes: string | null;
      payload: Record<string, unknown> | null;
      createdAt: number;
    }[]
  >;

  abstract insertDiscrepancy(data: {
    transferId: number;
    transferItemId: number;
    quantity: number;
    reason: string;
    resolution: string;
    notes?: string | null;
    resolvedBy: number;
    resolvedAt: number;
    createdAt: number;
  }): Promise<number>;

  abstract listDiscrepancies(transferId: number): Promise<
    {
      id: number;
      transferId: number;
      transferItemId: number;
      quantity: number;
      reason: string;
      resolution: string;
      notes: string | null;
      resolvedBy: number;
      resolvedAt: number;
      createdAt: number;
    }[]
  >;

  abstract countReceipts(transferId: number): Promise<number>;

  abstract createReceipt(data: {
    transferId: number;
    shipmentId?: number | null;
    reference: string;
    notes?: string | null;
    receivedBy: number;
    receivedAt: number;
    createdAt: number;
  }): Promise<number>;

  abstract insertReceiptItem(data: {
    receiptId: number;
    transferItemId: number;
    quantityReceived: number;
    createdAt: number;
  }): Promise<number>;

  abstract listReceipts(transferId: number): Promise<
    {
      id: number;
      transferId: number;
      shipmentId: number | null;
      reference: string;
      notes: string | null;
      receivedBy: number;
      receivedAt: number;
      items: {
        id: number;
        receiptId: number;
        transferItemId: number;
        quantityReceived: number;
      }[];
    }[]
  >;
}
