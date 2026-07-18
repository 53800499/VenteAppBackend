export const StockTransferStatus = {
  DRAFT: 'draft',
  VALIDATED: 'validated',
  PARTIALLY_SHIPPED: 'partially_shipped',
  SHIPPED: 'shipped',
  PARTIALLY_RECEIVED: 'partially_received',
  RECEIVED: 'received',
  CLOSED: 'closed',
  CLOSED_WITH_EXCEPTION: 'closed_with_exception',
  CANCELLED: 'cancelled',
} as const;

export type StockTransferStatusValue =
  (typeof StockTransferStatus)[keyof typeof StockTransferStatus];

export type StockTransferDiscrepancyReason = 'loss' | 'breakage' | 'theft' | 'other';
export type StockTransferDiscrepancyResolution = 'write_off' | 'restock_source';

export class StockTransferEvent {
  constructor(
    public readonly id: number,
    public readonly transferId: number,
    public readonly shopId: number,
    public readonly eventType: string,
    public readonly actorUserId: number,
    public readonly notes: string | null,
    public readonly payload: Record<string, unknown> | null,
    public readonly createdAt: number,
  ) {}
}

export class StockTransferDiscrepancy {
  constructor(
    public readonly id: number,
    public readonly transferId: number,
    public readonly transferItemId: number,
    public readonly quantity: number,
    public readonly reason: StockTransferDiscrepancyReason,
    public readonly resolution: StockTransferDiscrepancyResolution,
    public readonly notes: string | null,
    public readonly resolvedBy: number,
    public readonly resolvedAt: number,
    public readonly createdAt: number,
  ) {}
}

export class StockTransferLotLine {
  constructor(
    public readonly id: number,
    public readonly transferItemId: number,
    public readonly shipmentId: number | null,
    public readonly sourceLotId: number,
    public readonly destinationLotId: number | null,
    public readonly quantity: number,
    public readonly quantityReceived: number,
    public readonly unitCost: number,
  ) {}
}

export class StockTransferShipment {
  constructor(
    public readonly id: number,
    public readonly transferId: number,
    public readonly reference: string,
    public readonly label: string,
    public readonly notes: string | null,
    public readonly driverName: string | null,
    public readonly vehiclePlate: string | null,
    public readonly shippedBy: number,
    public readonly shippedAt: number,
  ) {}
}

export class StockTransferReceiptItem {
  constructor(
    public readonly id: number,
    public readonly receiptId: number,
    public readonly transferItemId: number,
    public readonly quantityReceived: number,
  ) {}
}

export class StockTransferReceipt {
  constructor(
    public readonly id: number,
    public readonly transferId: number,
    public readonly shipmentId: number | null,
    public readonly reference: string,
    public readonly notes: string | null,
    public readonly receivedBy: number,
    public readonly receivedAt: number,
    public readonly items: StockTransferReceiptItem[] = [],
  ) {}
}

export class StockTransferItem {
  constructor(
    public readonly id: number,
    public readonly transferId: number,
    public readonly sourceProductId: number,
    public readonly destinationProductId: number | null,
    public readonly productServerId: string | null,
    public readonly productName: string | null,
    public readonly quantityRequested: number,
    public readonly quantityShipped: number,
    public readonly quantityReceived: number,
    public readonly lotLines: StockTransferLotLine[] = [],
  ) {}
}

export class StockTransfer {
  constructor(
    public readonly id: number,
    public readonly reference: string,
    public readonly sourceShopId: number,
    public readonly destinationShopId: number,
    public readonly sourceShopName: string | null,
    public readonly destinationShopName: string | null,
    public readonly status: StockTransferStatusValue,
    public readonly notes: string | null,
    public readonly createdBy: number,
    public readonly validatedBy: number | null,
    public readonly shippedBy: number | null,
    public readonly receivedBy: number | null,
    public readonly closedBy: number | null,
    public readonly createdAt: number,
    public readonly updatedAt: number,
    public readonly validatedAt: number | null,
    public readonly shippedAt: number | null,
    public readonly receivedAt: number | null,
    public readonly closedAt: number | null,
    public readonly version: number,
    public readonly transferType: string,
    public readonly parentTransferId: number | null,
    public readonly items: StockTransferItem[] = [],
    public readonly shipments: StockTransferShipment[] = [],
    public readonly receipts: StockTransferReceipt[] = [],
    public readonly events: StockTransferEvent[] = [],
    public readonly discrepancies: StockTransferDiscrepancy[] = [],
  ) {}
}
