import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import {
  StockTransfer,
  StockTransferDiscrepancy,
  StockTransferDiscrepancyReason,
  StockTransferDiscrepancyResolution,
  StockTransferEvent,
  StockTransferItem,
  StockTransferLotLine,
  StockTransferReceipt,
  StockTransferReceiptItem,
  StockTransferShipment,
  StockTransferStatus,
  StockTransferStatusValue,
} from '../../domain/entities/stock-transfer.entity';
import {
  CreateStockTransferData,
  CreateStockTransferItemData,
  StockTransferRepository,
} from '../../domain/repositories/stock-transfer.repository';

@Injectable()
export class SupabaseStockTransferRepository extends StockTransferRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async listOutgoing(
    sourceShopId: number,
    options?: { updatedAfter?: number },
  ): Promise<StockTransfer[]> {
    let query = this.supabase.db
      .from('stock_transfers')
      .select(
        `
        *,
        source_shop:shops!stock_transfers_source_shop_id_fkey ( name ),
        destination_shop:shops!stock_transfers_destination_shop_id_fkey ( name )
      `,
      )
      .eq('source_shop_id', sourceShopId);

    if (options?.updatedAfter != null) {
      query = query.gt('updated_at', options.updatedAfter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return this.hydrateTransferRows(data ?? []);
  }

  async listIncoming(
    destinationShopId: number,
    options?: { updatedAfter?: number },
  ): Promise<StockTransfer[]> {
    let query = this.supabase.db
      .from('stock_transfers')
      .select(
        `
        *,
        source_shop:shops!stock_transfers_source_shop_id_fkey ( name ),
        destination_shop:shops!stock_transfers_destination_shop_id_fkey ( name )
      `,
      )
      .eq('destination_shop_id', destinationShopId)
      .in('status', [
        StockTransferStatus.VALIDATED,
        StockTransferStatus.RECEIVED,
      ]);

    if (options?.updatedAfter != null) {
      query = query.gt('updated_at', options.updatedAfter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return this.hydrateTransferRows(data ?? []);
  }

  async findById(id: number): Promise<StockTransfer | null> {
    const { data: row, error } = await this.supabase.db
      .from('stock_transfers')
      .select(
        `
        *,
        source_shop:shops!stock_transfers_source_shop_id_fkey ( name ),
        destination_shop:shops!stock_transfers_destination_shop_id_fkey ( name )
      `,
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!row) return null;

    const { data: itemRows, error: itemErr } = await this.supabase.db
      .from('stock_transfer_items')
      .select(
        `
        *,
        source_product:products!source_product_id ( name ),
        destination_product:products!destination_product_id ( name )
      `,
      )
      .eq('transfer_id', id);

    if (itemErr) throw new BadRequestException(itemErr.message);

    const items: StockTransferItem[] = [];
    for (const itemRow of itemRows ?? []) {
      const { data: lotRows, error: lotErr } = await this.supabase.db
        .from('stock_transfer_lot_lines')
        .select('*')
        .eq('transfer_item_id', itemRow.id);

      if (lotErr) throw new BadRequestException(lotErr.message);

      items.push(this.mapItem(itemRow, (lotRows ?? []).map(this.mapLotLine)));
    }

    return this.mapTransfer(
      row,
      items,
      await this.listShipments(id),
      await this.listReceipts(id),
      await this.listEvents(id),
      await this.listDiscrepancies(id),
    );
  }

  async createTransfer(
    sourceShopId: number,
    data: CreateStockTransferData,
    items: CreateStockTransferItemData[],
  ): Promise<StockTransfer> {
    const timestamp = nowMs();

    const { data: row, error } = await this.supabase.db
      .from('stock_transfers')
      .insert({
        reference: data.reference,
        source_shop_id: sourceShopId,
        destination_shop_id: data.destinationShopId,
        status: StockTransferStatus.DRAFT,
        notes: data.notes ?? null,
        transfer_type: data.transferType ?? 'outbound',
        parent_transfer_id: data.parentTransferId ?? null,
        created_by: data.createdBy,
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
        sync_status: 'synced',
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible de créer le transfert.');
    }

    for (const item of items) {
      const serverId =
        item.productServerId ??
        (await this.findProductServerId(item.sourceProductId, sourceShopId));

      const { error: itemErr } = await this.supabase.db.from('stock_transfer_items').insert({
        transfer_id: row.id,
        source_product_id: item.sourceProductId,
        product_server_id: serverId,
        quantity_requested: item.quantityRequested,
        quantity_shipped: 0,
        quantity_received: 0,
      });

      if (itemErr) {
        throw new BadRequestException(itemErr.message);
      }
    }

    const created = await this.findById(row.id);
    if (!created) {
      throw new BadRequestException('Transfert introuvable après création.');
    }
    return created;
  }

  async updateStatus(
    id: number,
    status: StockTransferStatusValue,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const timestamp = nowMs();
    const { error } = await this.supabase.db
      .from('stock_transfers')
      .update({
        status,
        updated_at: timestamp,
        version: (patch.version as number | undefined) ?? undefined,
        validated_by: patch.validated_by ?? undefined,
        validated_at: patch.validated_at ?? undefined,
        shipped_by: patch.shipped_by ?? undefined,
        shipped_at: patch.shipped_at ?? undefined,
        received_by: patch.received_by ?? undefined,
        received_at: patch.received_at ?? undefined,
        closed_by: patch.closed_by ?? undefined,
        closed_at: patch.closed_at ?? undefined,
        sync_status: 'synced',
      })
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
  }

  async createShipment(
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
  ): Promise<number> {
    const { data: row, error } = await this.supabase.db
      .from('stock_transfer_shipments')
      .insert({
        transfer_id: transferId,
        reference: data.reference,
        label: data.label,
        notes: data.notes ?? null,
        driver_name: data.driverName ?? null,
        vehicle_plate: data.vehiclePlate ?? null,
        shipped_by: data.shippedBy,
        shipped_at: data.shippedAt,
      })
      .select('id')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible de créer l\'expédition.');
    }
    return row.id as number;
  }

  async listShipments(transferId: number) {
    const { data, error } = await this.supabase.db
      .from('stock_transfer_shipments')
      .select('*')
      .eq('transfer_id', transferId)
      .order('shipped_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as number,
      transferId: row.transfer_id as number,
      reference: (row.reference as string) ?? '',
      label: row.label as string,
      notes: (row.notes as string | null) ?? null,
      driverName: (row.driver_name as string | null) ?? null,
      vehiclePlate: (row.vehicle_plate as string | null) ?? null,
      shippedBy: row.shipped_by as number,
      shippedAt: row.shipped_at as number,
    }));
  }

  async insertReservation(
    transferItemId: number,
    lotId: number,
    quantity: number,
    unitCost: number,
  ): Promise<void> {
    const { error } = await this.supabase.db.from('stock_transfer_lot_reservations').insert({
      transfer_item_id: transferItemId,
      lot_id: lotId,
      quantity,
      quantity_shipped: 0,
      unit_cost: unitCost,
    });
    if (error) throw new BadRequestException(error.message);
  }

  async listReservationsByItem(transferItemId: number) {
    const { data, error } = await this.supabase.db
      .from('stock_transfer_lot_reservations')
      .select('*')
      .eq('transfer_item_id', transferItemId);

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as number,
      lotId: row.lot_id as number,
      quantity: row.quantity as number,
      quantityShipped: (row.quantity_shipped as number) ?? 0,
      unitCost: Number(row.unit_cost),
    }));
  }

  async updateReservationShipped(
    reservationId: number,
    quantityShipped: number,
  ): Promise<void> {
    const { error } = await this.supabase.db
      .from('stock_transfer_lot_reservations')
      .update({ quantity_shipped: quantityShipped })
      .eq('id', reservationId);
    if (error) throw new BadRequestException(error.message);
  }

  async deleteReservationsByItem(transferItemId: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('stock_transfer_lot_reservations')
      .delete()
      .eq('transfer_item_id', transferItemId);
    if (error) throw new BadRequestException(error.message);
  }

  async incrementItemShipped(itemId: number, delta: number): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('stock_transfer_items')
      .select('quantity_shipped')
      .eq('id', itemId)
      .maybeSingle();
    if (error || !data) throw new BadRequestException(error?.message ?? 'Article introuvable.');

    const next = (data.quantity_shipped as number) + delta;
    const { error: updateErr } = await this.supabase.db
      .from('stock_transfer_items')
      .update({ quantity_shipped: next })
      .eq('id', itemId);
    if (updateErr) throw new BadRequestException(updateErr.message);
  }

  async insertLotLines(
    transferItemId: number,
    lines: {
      sourceLotId: number;
      quantity: number;
      unitCost: number;
      shipmentId?: number | null;
    }[],
  ): Promise<StockTransferLotLine[]> {
    const result: StockTransferLotLine[] = [];
    for (const line of lines) {
      const { data, error } = await this.supabase.db
        .from('stock_transfer_lot_lines')
        .insert({
          transfer_item_id: transferItemId,
          shipment_id: line.shipmentId ?? null,
          source_lot_id: line.sourceLotId,
          quantity: line.quantity,
          unit_cost: line.unitCost,
          quantity_received: 0,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new BadRequestException(error?.message ?? 'Impossible d\'enregistrer la ligne lot.');
      }
      result.push(this.mapLotLine(data));
    }
    return result;
  }

  async updateItemShipped(itemId: number, quantityShipped: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('stock_transfer_items')
      .update({ quantity_shipped: quantityShipped })
      .eq('id', itemId);

    if (error) throw new BadRequestException(error.message);
  }

  async updateItemDestinationProduct(
    itemId: number,
    destinationProductId: number,
  ): Promise<void> {
    const { error } = await this.supabase.db
      .from('stock_transfer_items')
      .update({ destination_product_id: destinationProductId })
      .eq('id', itemId);

    if (error) throw new BadRequestException(error.message);
  }

  async listInTransit(
    shopId: number,
    options?: { updatedAfter?: number },
  ): Promise<StockTransfer[]> {
    let query = this.supabase.db
      .from('stock_transfers')
      .select(
        `
        *,
        source_shop:shops!stock_transfers_source_shop_id_fkey ( name ),
        destination_shop:shops!stock_transfers_destination_shop_id_fkey ( name )
      `,
      )
      .or(`source_shop_id.eq.${shopId},destination_shop_id.eq.${shopId}`)
      .in('status', [
        StockTransferStatus.PARTIALLY_SHIPPED,
        StockTransferStatus.SHIPPED,
        StockTransferStatus.PARTIALLY_RECEIVED,
      ]);

    if (options?.updatedAfter != null) {
      query = query.gt('updated_at', options.updatedAfter);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return this.hydrateTransferRows(data ?? []);
  }

  async updateItemReceived(
    itemId: number,
    quantityReceived: number,
    destinationProductId?: number | null,
  ): Promise<void> {
    const patch: Record<string, unknown> = { quantity_received: quantityReceived };
    if (destinationProductId != null) {
      patch.destination_product_id = destinationProductId;
    }

    const { error } = await this.supabase.db
      .from('stock_transfer_items')
      .update(patch)
      .eq('id', itemId);

    if (error) throw new BadRequestException(error.message);
  }

  async updateLotLineReceived(
    lotLineId: number,
    quantityReceived: number,
    destinationLotId: number,
  ): Promise<void> {
    const { error } = await this.supabase.db
      .from('stock_transfer_lot_lines')
      .update({
        quantity_received: quantityReceived,
        destination_lot_id: destinationLotId,
      })
      .eq('id', lotLineId);

    if (error) throw new BadRequestException(error.message);
  }

  async nextReference(sourceShopIds: number[]): Promise<string> {
    if (sourceShopIds.length === 0) {
      return 'TRF-00001';
    }

    const { data, error } = await this.supabase.db
      .from('stock_transfers')
      .select('reference')
      .or(
        `source_shop_id.in.(${sourceShopIds.join(',')}),destination_shop_id.in.(${sourceShopIds.join(',')})`,
      );

    if (error) throw new BadRequestException(error.message);

    const maxSeq = this.maxTransferSequence(
      (data ?? []).map((row) => String(row.reference ?? '')),
    );
    return `TRF-${String(maxSeq + 1).padStart(5, '0')}`;
  }

  async isReferenceUsed(
    sourceShopIds: number[],
    reference: string,
  ): Promise<boolean> {
    const trimmed = reference.trim();
    if (sourceShopIds.length === 0 || trimmed.length === 0) return false;

    const { data, error } = await this.supabase.db
      .from('stock_transfers')
      .select('id')
      .eq('reference', trimmed)
      .or(
        `source_shop_id.in.(${sourceShopIds.join(',')}),destination_shop_id.in.(${sourceShopIds.join(',')})`,
      )
      .limit(1);

    if (error) throw new BadRequestException(error.message);
    return (data?.length ?? 0) > 0;
  }

  private maxTransferSequence(references: string[]): number {
    let maxSeq = 0;
    for (const reference of references) {
      const match = /^(?:TRF|RET)-(\d+)$/i.exec(reference.trim());
      if (!match) continue;
      const seq = Number.parseInt(match[1], 10);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
    return maxSeq;
  }

  async findProductServerId(productId: number, shopId: number): Promise<string | null> {
    const { data, error } = await this.supabase.db
      .from('products')
      .select('server_id')
      .eq('id', productId)
      .eq('shop_id', shopId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data?.server_id ?? null;
  }

  async findProductIdByServerId(
    shopId: number,
    serverId: string,
  ): Promise<number | null> {
    const { data, error } = await this.supabase.db
      .from('products')
      .select('id')
      .eq('shop_id', shopId)
      .eq('server_id', serverId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data?.id ?? null;
  }

  async insertEvent(data: {
    transferId: number;
    shopId: number;
    eventType: string;
    actorUserId: number;
    notes?: string | null;
    payload?: Record<string, unknown> | null;
    createdAt: number;
  }): Promise<number> {
    const { data: row, error } = await this.supabase.db
      .from('stock_transfer_events')
      .insert({
        transfer_id: data.transferId,
        shop_id: data.shopId,
        event_type: data.eventType,
        actor_user_id: data.actorUserId,
        notes: data.notes ?? null,
        payload: data.payload ?? null,
        created_at: data.createdAt,
      })
      .select('id')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible d\'enregistrer l\'événement.');
    }
    return row.id as number;
  }

  async listEvents(transferId: number) {
    const { data, error } = await this.supabase.db
      .from('stock_transfer_events')
      .select('*')
      .eq('transfer_id', transferId)
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as number,
      transferId: row.transfer_id as number,
      shopId: row.shop_id as number,
      eventType: row.event_type as string,
      actorUserId: row.actor_user_id as number,
      notes: (row.notes as string | null) ?? null,
      payload: (row.payload as Record<string, unknown> | null) ?? null,
      createdAt: row.created_at as number,
    }));
  }

  async insertDiscrepancy(data: {
    transferId: number;
    transferItemId: number;
    quantity: number;
    reason: string;
    resolution: string;
    notes?: string | null;
    resolvedBy: number;
    resolvedAt: number;
    createdAt: number;
  }): Promise<number> {
    const { data: row, error } = await this.supabase.db
      .from('stock_transfer_discrepancies')
      .insert({
        transfer_id: data.transferId,
        transfer_item_id: data.transferItemId,
        quantity: data.quantity,
        reason: data.reason,
        resolution: data.resolution,
        notes: data.notes ?? null,
        resolved_by: data.resolvedBy,
        resolved_at: data.resolvedAt,
        created_at: data.createdAt,
      })
      .select('id')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible d\'enregistrer l\'écart.');
    }
    return row.id as number;
  }

  async listDiscrepancies(transferId: number) {
    const { data, error } = await this.supabase.db
      .from('stock_transfer_discrepancies')
      .select('*')
      .eq('transfer_id', transferId)
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as number,
      transferId: row.transfer_id as number,
      transferItemId: row.transfer_item_id as number,
      quantity: row.quantity as number,
      reason: row.reason as string,
      resolution: row.resolution as string,
      notes: (row.notes as string | null) ?? null,
      resolvedBy: row.resolved_by as number,
      resolvedAt: row.resolved_at as number,
      createdAt: row.created_at as number,
    }));
  }

  async countReceipts(transferId: number): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('stock_transfer_receipts')
      .select('id', { count: 'exact', head: true })
      .eq('transfer_id', transferId);

    if (error) throw new BadRequestException(error.message);
    return count ?? 0;
  }

  async createReceipt(data: {
    transferId: number;
    shipmentId?: number | null;
    reference: string;
    notes?: string | null;
    receivedBy: number;
    receivedAt: number;
    createdAt: number;
  }): Promise<number> {
    const { data: row, error } = await this.supabase.db
      .from('stock_transfer_receipts')
      .insert({
        transfer_id: data.transferId,
        shipment_id: data.shipmentId ?? null,
        reference: data.reference,
        notes: data.notes ?? null,
        received_by: data.receivedBy,
        received_at: data.receivedAt,
        created_at: data.createdAt,
      })
      .select('id')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible d\'enregistrer la réception.');
    }
    return row.id as number;
  }

  async insertReceiptItem(data: {
    receiptId: number;
    transferItemId: number;
    quantityReceived: number;
    quantityRefused?: number;
    refusalReason?: string | null;
    refusalResolution?: string | null;
    createdAt: number;
  }): Promise<number> {
    const { data: row, error } = await this.supabase.db
      .from('stock_transfer_receipt_items')
      .insert({
        receipt_id: data.receiptId,
        transfer_item_id: data.transferItemId,
        quantity_received: data.quantityReceived,
        quantity_refused: data.quantityRefused ?? 0,
        refusal_reason: data.refusalReason ?? null,
        refusal_resolution: data.refusalResolution ?? null,
        created_at: data.createdAt,
      })
      .select('id')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible d\'enregistrer la ligne de réception.');
    }
    return row.id as number;
  }

  async listReceipts(transferId: number) {
    const { data, error } = await this.supabase.db
      .from('stock_transfer_receipts')
      .select('*')
      .eq('transfer_id', transferId)
      .order('received_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    const receipts: {
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
        quantityRefused: number;
        refusalReason: string | null;
        refusalResolution: string | null;
      }[];
    }[] = [];
    for (const row of data ?? []) {
      const { data: itemRows, error: itemErr } = await this.supabase.db
        .from('stock_transfer_receipt_items')
        .select('*')
        .eq('receipt_id', row.id);

      if (itemErr) throw new BadRequestException(itemErr.message);

      receipts.push({
        id: row.id as number,
        transferId: row.transfer_id as number,
        shipmentId: (row.shipment_id as number | null) ?? null,
        reference: row.reference as string,
        notes: (row.notes as string | null) ?? null,
        receivedBy: row.received_by as number,
        receivedAt: row.received_at as number,
        items: (itemRows ?? []).map((itemRow) => ({
          id: itemRow.id as number,
          receiptId: itemRow.receipt_id as number,
          transferItemId: itemRow.transfer_item_id as number,
          quantityReceived: itemRow.quantity_received as number,
          quantityRefused: (itemRow.quantity_refused as number | null) ?? 0,
          refusalReason: (itemRow.refusal_reason as string | null) ?? null,
          refusalResolution: (itemRow.refusal_resolution as string | null) ?? null,
        })),
      });
    }
    return receipts;
  }

  /**
   * Charge items / lots / shipments / receipts / events / discrepancies
   * pour une liste de transferts (évite N× GET détail côté client).
   */
  private async hydrateTransferRows(
    rows: Record<string, any>[],
  ): Promise<StockTransfer[]> {
    if (rows.length === 0) return [];

    const transferIds = rows.map((row) => row.id as number);

    const { data: itemRows, error: itemErr } = await this.supabase.db
      .from('stock_transfer_items')
      .select(
        `
        *,
        source_product:products!source_product_id ( name ),
        destination_product:products!destination_product_id ( name )
      `,
      )
      .in('transfer_id', transferIds);

    if (itemErr) throw new BadRequestException(itemErr.message);

    const itemsByTransfer = new Map<number, typeof itemRows>();
    const itemIds: number[] = [];
    for (const itemRow of itemRows ?? []) {
      const transferId = itemRow.transfer_id as number;
      const bucket = itemsByTransfer.get(transferId) ?? [];
      bucket.push(itemRow);
      itemsByTransfer.set(transferId, bucket);
      itemIds.push(itemRow.id as number);
    }

    const lotsByItem = new Map<number, ReturnType<typeof this.mapLotLine>[]>();
    if (itemIds.length > 0) {
      const { data: lotRows, error: lotErr } = await this.supabase.db
        .from('stock_transfer_lot_lines')
        .select('*')
        .in('transfer_item_id', itemIds);
      if (lotErr) throw new BadRequestException(lotErr.message);
      for (const lotRow of lotRows ?? []) {
        const itemId = lotRow.transfer_item_id as number;
        const bucket = lotsByItem.get(itemId) ?? [];
        bucket.push(this.mapLotLine(lotRow));
        lotsByItem.set(itemId, bucket);
      }
    }

    const [
      shipmentsByTransfer,
      receiptsByTransfer,
      eventsByTransfer,
      discrepanciesByTransfer,
    ] = await Promise.all([
      this.listShipmentsForTransfers(transferIds),
      this.listReceiptsForTransfers(transferIds),
      this.listEventsForTransfers(transferIds),
      this.listDiscrepanciesForTransfers(transferIds),
    ]);

    return rows.map((row) => {
      const transferId = row.id as number;
      const items = (itemsByTransfer.get(transferId) ?? []).map((itemRow) =>
        this.mapItem(itemRow, lotsByItem.get(itemRow.id as number) ?? []),
      );
      return this.mapTransfer(
        row,
        items,
        shipmentsByTransfer.get(transferId) ?? [],
        receiptsByTransfer.get(transferId) ?? [],
        eventsByTransfer.get(transferId) ?? [],
        discrepanciesByTransfer.get(transferId) ?? [],
      );
    });
  }

  private async listShipmentsForTransfers(transferIds: number[]) {
    const byTransfer = new Map<number, Awaited<ReturnType<SupabaseStockTransferRepository['listShipments']>>>();
    if (transferIds.length === 0) return byTransfer;

    const { data, error } = await this.supabase.db
      .from('stock_transfer_shipments')
      .select('*')
      .in('transfer_id', transferIds)
      .order('shipped_at', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    for (const row of data ?? []) {
      const transferId = row.transfer_id as number;
      const bucket = byTransfer.get(transferId) ?? [];
      bucket.push({
        id: row.id as number,
        transferId,
        reference: row.reference as string,
        label: row.label as string,
        notes: (row.notes as string | null) ?? null,
        driverName: (row.driver_name as string | null) ?? null,
        vehiclePlate: (row.vehicle_plate as string | null) ?? null,
        shippedBy: row.shipped_by as number,
        shippedAt: row.shipped_at as number,
      });
      byTransfer.set(transferId, bucket);
    }
    return byTransfer;
  }

  private async listEventsForTransfers(transferIds: number[]) {
    const byTransfer = new Map<number, Awaited<ReturnType<SupabaseStockTransferRepository['listEvents']>>>();
    if (transferIds.length === 0) return byTransfer;

    const { data, error } = await this.supabase.db
      .from('stock_transfer_events')
      .select('*')
      .in('transfer_id', transferIds)
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    for (const row of data ?? []) {
      const transferId = row.transfer_id as number;
      const bucket = byTransfer.get(transferId) ?? [];
      bucket.push({
        id: row.id as number,
        transferId,
        shopId: row.shop_id as number,
        eventType: row.event_type as string,
        actorUserId: row.actor_user_id as number,
        notes: (row.notes as string | null) ?? null,
        payload: (row.payload as Record<string, unknown> | null) ?? null,
        createdAt: row.created_at as number,
      });
      byTransfer.set(transferId, bucket);
    }
    return byTransfer;
  }

  private async listDiscrepanciesForTransfers(transferIds: number[]) {
    const byTransfer = new Map<
      number,
      Awaited<ReturnType<SupabaseStockTransferRepository['listDiscrepancies']>>
    >();
    if (transferIds.length === 0) return byTransfer;

    const { data, error } = await this.supabase.db
      .from('stock_transfer_discrepancies')
      .select('*')
      .in('transfer_id', transferIds)
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    for (const row of data ?? []) {
      const transferId = row.transfer_id as number;
      const bucket = byTransfer.get(transferId) ?? [];
      bucket.push({
        id: row.id as number,
        transferId,
        transferItemId: row.transfer_item_id as number,
        quantity: row.quantity as number,
        reason: row.reason as string,
        resolution: row.resolution as string,
        notes: (row.notes as string | null) ?? null,
        resolvedBy: row.resolved_by as number,
        resolvedAt: row.resolved_at as number,
        createdAt: row.created_at as number,
      });
      byTransfer.set(transferId, bucket);
    }
    return byTransfer;
  }

  private async listReceiptsForTransfers(transferIds: number[]) {
    const byTransfer = new Map<
      number,
      Awaited<ReturnType<SupabaseStockTransferRepository['listReceipts']>>
    >();
    if (transferIds.length === 0) return byTransfer;

    const { data, error } = await this.supabase.db
      .from('stock_transfer_receipts')
      .select('*')
      .in('transfer_id', transferIds)
      .order('received_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);

    const receiptRows = data ?? [];
    const receiptIds = receiptRows.map((row) => row.id as number);
    const itemsByReceipt = new Map<
      number,
      {
        id: number;
        receiptId: number;
        transferItemId: number;
        quantityReceived: number;
        quantityRefused: number;
        refusalReason: string | null;
        refusalResolution: string | null;
      }[]
    >();

    if (receiptIds.length > 0) {
      const { data: itemRows, error: itemErr } = await this.supabase.db
        .from('stock_transfer_receipt_items')
        .select('*')
        .in('receipt_id', receiptIds);
      if (itemErr) throw new BadRequestException(itemErr.message);
      for (const itemRow of itemRows ?? []) {
        const receiptId = itemRow.receipt_id as number;
        const bucket = itemsByReceipt.get(receiptId) ?? [];
        bucket.push({
          id: itemRow.id as number,
          receiptId,
          transferItemId: itemRow.transfer_item_id as number,
          quantityReceived: itemRow.quantity_received as number,
          quantityRefused: (itemRow.quantity_refused as number | null) ?? 0,
          refusalReason: (itemRow.refusal_reason as string | null) ?? null,
          refusalResolution:
            (itemRow.refusal_resolution as string | null) ?? null,
        });
        itemsByReceipt.set(receiptId, bucket);
      }
    }

    for (const row of receiptRows) {
      const transferId = row.transfer_id as number;
      const receiptId = row.id as number;
      const bucket = byTransfer.get(transferId) ?? [];
      bucket.push({
        id: receiptId,
        transferId,
        shipmentId: (row.shipment_id as number | null) ?? null,
        reference: row.reference as string,
        notes: (row.notes as string | null) ?? null,
        receivedBy: row.received_by as number,
        receivedAt: row.received_at as number,
        items: itemsByReceipt.get(receiptId) ?? [],
      });
      byTransfer.set(transferId, bucket);
    }
    return byTransfer;
  }

  private mapTransfer(
    row: Record<string, any>,
    items: StockTransferItem[] = [],
    shipments: {
      id: number;
      transferId: number;
      reference: string;
      label: string;
      notes: string | null;
      driverName: string | null;
      vehiclePlate: string | null;
      shippedBy: number;
      shippedAt: number;
    }[] = [],
    receipts: {
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
        quantityRefused: number;
        refusalReason: string | null;
        refusalResolution: string | null;
      }[];
    }[] = [],
    events: {
      id: number;
      transferId: number;
      shopId: number;
      eventType: string;
      actorUserId: number;
      notes: string | null;
      payload: Record<string, unknown> | null;
      createdAt: number;
    }[] = [],
    discrepancies: {
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
    }[] = [],
  ) {
    return new StockTransfer(
      row.id,
      row.reference,
      row.source_shop_id,
      row.destination_shop_id,
      row.source_shop?.name ?? null,
      row.destination_shop?.name ?? null,
      row.status,
      row.notes ?? null,
      row.created_by,
      row.validated_by ?? null,
      row.shipped_by ?? null,
      row.received_by ?? null,
      row.closed_by ?? null,
      row.created_at,
      row.updated_at,
      row.validated_at ?? null,
      row.shipped_at ?? null,
      row.received_at ?? null,
      row.closed_at ?? null,
      row.version ?? 1,
      row.transfer_type ?? 'outbound',
      row.parent_transfer_id ?? null,
      items,
      shipments.map(
        (s) =>
          new StockTransferShipment(
            s.id,
            s.transferId,
            s.reference,
            s.label,
            s.notes,
            s.driverName,
            s.vehiclePlate,
            s.shippedBy,
            s.shippedAt,
          ),
      ),
      receipts.map(
        (receipt) =>
          new StockTransferReceipt(
            receipt.id,
            receipt.transferId,
            receipt.shipmentId,
            receipt.reference,
            receipt.notes,
            receipt.receivedBy,
            receipt.receivedAt,
            receipt.items.map(
              (item) =>
                new StockTransferReceiptItem(
                  item.id,
                  item.receiptId,
                  item.transferItemId,
                  item.quantityReceived,
                  item.quantityRefused,
                  item.refusalReason as StockTransferReceiptItem['refusalReason'],
                  item.refusalResolution as StockTransferReceiptItem['refusalResolution'],
                ),
            ),
          ),
      ),
      events.map(
        (event) =>
          new StockTransferEvent(
            event.id,
            event.transferId,
            event.shopId,
            event.eventType,
            event.actorUserId,
            event.notes,
            event.payload,
            event.createdAt,
          ),
      ),
      discrepancies.map(
        (row) =>
          new StockTransferDiscrepancy(
            row.id,
            row.transferId,
            row.transferItemId,
            row.quantity,
            row.reason as StockTransferDiscrepancyReason,
            row.resolution as StockTransferDiscrepancyResolution,
            row.notes,
            row.resolvedBy,
            row.resolvedAt,
            row.createdAt,
          ),
      ),
    );
  }

  private mapItem(row: Record<string, any>, lotLines: StockTransferLotLine[]) {
    return new StockTransferItem(
      row.id,
      row.transfer_id,
      row.source_product_id,
      row.destination_product_id ?? null,
      row.product_server_id ?? null,
      row.source_product?.name ?? row.destination_product?.name ?? null,
      row.quantity_requested,
      row.quantity_shipped ?? 0,
      row.quantity_received ?? 0,
      lotLines,
    );
  }

  private mapLotLine(row: Record<string, any>) {
    return new StockTransferLotLine(
      row.id,
      row.transfer_item_id,
      row.shipment_id ?? null,
      row.source_lot_id,
      row.destination_lot_id ?? null,
      row.quantity,
      row.quantity_received ?? 0,
      row.unit_cost,
    );
  }
}
