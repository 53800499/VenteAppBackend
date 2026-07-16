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
      label: string;
      notes?: string | null;
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
      label: string;
      notes: string | null;
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
}
