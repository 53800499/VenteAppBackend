import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import {
  StockTransfer,
  StockTransferItem,
  StockTransferLotLine,
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

  async listOutgoing(sourceShopId: number): Promise<StockTransfer[]> {
    const { data, error } = await this.supabase.db
      .from('stock_transfers')
      .select(
        `
        *,
        source_shop:shops!stock_transfers_source_shop_id_fkey ( name ),
        destination_shop:shops!stock_transfers_destination_shop_id_fkey ( name )
      `,
      )
      .eq('source_shop_id', sourceShopId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.mapTransfer(row));
  }

  async listIncoming(destinationShopId: number): Promise<StockTransfer[]> {
    const { data, error } = await this.supabase.db
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
        StockTransferStatus.PARTIALLY_SHIPPED,
        StockTransferStatus.SHIPPED,
        StockTransferStatus.PARTIALLY_RECEIVED,
        StockTransferStatus.RECEIVED,
      ])
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.mapTransfer(row));
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
        source_product:products!source_product_id ( name )
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

    return this.mapTransfer(row, items, await this.listShipments(id));
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
        sync_status: 'synced',
      })
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
  }

  async createShipment(
    transferId: number,
    data: {
      label: string;
      notes?: string | null;
      shippedBy: number;
      shippedAt: number;
    },
  ): Promise<number> {
    const { data: row, error } = await this.supabase.db
      .from('stock_transfer_shipments')
      .insert({
        transfer_id: transferId,
        label: data.label,
        notes: data.notes ?? null,
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
      label: row.label as string,
      notes: (row.notes as string | null) ?? null,
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

  async nextReference(sourceShopId: number): Promise<string> {
    const { count, error } = await this.supabase.db
      .from('stock_transfers')
      .select('*', { count: 'exact', head: true })
      .eq('source_shop_id', sourceShopId);

    if (error) throw new BadRequestException(error.message);
    const seq = (count ?? 0) + 1;
    return `TRF-${String(seq).padStart(5, '0')}`;
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

  private mapTransfer(
    row: Record<string, any>,
    items: StockTransferItem[] = [],
    shipments: {
      id: number;
      transferId: number;
      label: string;
      notes: string | null;
      shippedBy: number;
      shippedAt: number;
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
      row.created_at,
      row.updated_at,
      row.validated_at ?? null,
      row.shipped_at ?? null,
      row.received_at ?? null,
      row.version ?? 1,
      row.transfer_type ?? 'outbound',
      row.parent_transfer_id ?? null,
      items,
      shipments.map(
        (s) =>
          new StockTransferShipment(
            s.id,
            s.transferId,
            s.label,
            s.notes,
            s.shippedBy,
            s.shippedAt,
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
      row.source_product?.name ?? null,
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
