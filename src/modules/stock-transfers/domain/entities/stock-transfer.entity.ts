export const StockTransferStatus = {
  DRAFT: 'draft',
  VALIDATED: 'validated',
  PARTIALLY_SHIPPED: 'partially_shipped',
  SHIPPED: 'shipped',
  PARTIALLY_RECEIVED: 'partially_received',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
} as const;

export type StockTransferStatusValue =
  (typeof StockTransferStatus)[keyof typeof StockTransferStatus];

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
    public readonly label: string,
    public readonly notes: string | null,
    public readonly shippedBy: number,
    public readonly shippedAt: number,
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
    public readonly createdAt: number,
    public readonly updatedAt: number,
    public readonly validatedAt: number | null,
    public readonly shippedAt: number | null,
    public readonly receivedAt: number | null,
    public readonly version: number,
    public readonly transferType: string,
    public readonly parentTransferId: number | null,
    public readonly items: StockTransferItem[] = [],
    public readonly shipments: StockTransferShipment[] = [],
  ) {}
}
