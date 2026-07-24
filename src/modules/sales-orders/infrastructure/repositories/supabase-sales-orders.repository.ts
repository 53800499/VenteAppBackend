import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import {
  computeStatusAfterFulfillment,
  SalesOrderDeliveryEntity,
  SalesOrderDeliveryItemEntity,
  SalesOrderEntity,
  SalesOrderItemEntity,
  SalesOrderStatus,
} from '../../domain/entities/sales-order.entity';
import {
  CreateSalesOrderData,
  InsertDeliveryData,
  SalesOrdersRepository,
  UpdateStatusOpts,
} from '../../domain/repositories/sales-orders.repository';
import { assertSalesOrderOptimisticVersion } from '../../domain/sales-order-version.lock';

@Injectable()
export class SupabaseSalesOrdersRepository extends SalesOrdersRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async list(
    shopId: number,
    status?: SalesOrderStatus,
    updatedAfter?: number,
  ): Promise<SalesOrderEntity[]> {
    let query = this.supabase.db
      .from('sales_orders')
      .select('*')
      .eq('shop_id', shopId)
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (updatedAfter != null && Number.isFinite(updatedAfter)) {
      query = query.gt('updated_at', updatedAfter);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);

    const orders: SalesOrderEntity[] = [];
    for (const row of data ?? []) {
      // Liste pull : head + items (pas les deliveries — GET :id pour le détail).
      orders.push(await this.loadDetails(shopId, row, { includeDeliveries: false }));
    }
    return orders;
  }

  async findById(
    shopId: number,
    id: number,
  ): Promise<SalesOrderEntity | null> {
    const { data, error } = await this.supabase.db
      .from('sales_orders')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return this.loadDetails(shopId, data);
  }

  async findByNumber(
    shopId: number,
    number: string,
  ): Promise<SalesOrderEntity | null> {
    const { data, error } = await this.supabase.db
      .from('sales_orders')
      .select('*')
      .eq('shop_id', shopId)
      .eq('number', number)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return this.loadDetails(shopId, data);
  }

  async create(
    shopId: number,
    data: CreateSalesOrderData,
  ): Promise<SalesOrderEntity> {
    const timestamp = nowMs();
    const { data: orderRow, error: orderErr } = await this.supabase.db
      .from('sales_orders')
      .insert({
        shop_id: shopId,
        customer_id: data.customerId,
        number: data.number,
        status: 'draft',
        ordered_at: data.orderedAt,
        subtotal: data.subtotal,
        discount: data.discount ?? 0,
        tax: data.tax ?? 0,
        total: data.total,
        notes: data.notes ?? null,
        created_by: data.createdBy,
        updated_by: data.createdBy,
        device_id: data.deviceId ?? null,
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
        sync_status: 'synced',
      })
      .select('*')
      .single();

    if (orderErr || !orderRow) {
      throw new BadRequestException(
        orderErr?.message ?? 'Impossible de créer la commande.',
      );
    }

    const itemsToInsert = data.items.map((it) => ({
      shop_id: shopId,
      sales_order_id: orderRow.id,
      product_id: it.productId,
      quantity_ordered: it.quantityOrdered,
      quantity_delivered: 0,
      quantity_refused: 0,
      unit_price: it.unitPrice,
      line_total: it.lineTotal,
      version: 1,
      sync_status: 'synced',
    }));

    const { data: itemRows, error: itemErr } = await this.supabase.db
      .from('sales_order_items')
      .insert(itemsToInsert)
      .select('*');

    if (itemErr) {
      await this.supabase.db.from('sales_orders').delete().eq('id', orderRow.id);
      throw new BadRequestException(itemErr.message);
    }

    await this.addHistory({
      shopId,
      orderId: orderRow.id as number,
      action: 'created',
      performedBy: data.createdBy,
      details: 'Commande créée',
      payload: { number: data.number, itemCount: data.items.length },
      ts: timestamp,
    });

    return this.mapOrder(
      orderRow,
      (itemRows ?? []).map((r) => this.mapItem(r)),
      [],
    );
  }

  async updateStatus(
    shopId: number,
    id: number,
    status: SalesOrderStatus,
    opts?: UpdateStatusOpts,
  ): Promise<SalesOrderEntity> {
    const timestamp = nowMs();
    const { data: current, error: readErr } = await this.supabase.db
      .from('sales_orders')
      .select('version, notes')
      .eq('shop_id', shopId)
      .eq('id', id)
      .maybeSingle();

    if (readErr) throw new BadRequestException(readErr.message);
    if (!current) throw new BadRequestException('Commande introuvable');

    const dbVersion = (current.version as number | undefined) ?? 1;
    assertSalesOrderOptimisticVersion(dbVersion, opts?.version);

    const nextVersion =
      opts?.version != null
        ? Math.max(
            opts.version,
            opts.version === dbVersion ? dbVersion : dbVersion + 1,
          )
        : dbVersion + 1;

    const updateData: Record<string, unknown> = {
      status,
      updated_at: timestamp,
      version: nextVersion,
      sync_status: 'synced',
    };
    if (opts?.notes !== undefined) {
      updateData.notes = opts.notes;
    }
    if (opts?.performedBy != null) {
      updateData.updated_by = opts.performedBy;
    }
    if (opts?.deviceId !== undefined) {
      updateData.device_id = opts.deviceId;
    }

    const { error } = await this.supabase.db
      .from('sales_orders')
      .update(updateData)
      .eq('shop_id', shopId)
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);

    if (opts) {
      await this.addHistory({
        shopId,
        orderId: id,
        action: opts.historyAction,
        performedBy: opts.performedBy,
        details: opts.historyDetails ?? status,
        payload: opts.historyPayload,
        ts: timestamp,
      });
    }

    const order = await this.findById(shopId, id);
    if (!order) throw new BadRequestException('Commande introuvable');
    return order;
  }

  async insertDelivery(
    shopId: number,
    orderId: number,
    data: InsertDeliveryData,
  ): Promise<SalesOrderEntity> {
    const order = await this.findById(shopId, orderId);
    if (!order) throw new BadRequestException('Commande introuvable');

    assertSalesOrderOptimisticVersion(order.version, data.version);

    const timestamp = nowMs();
    const { data: deliveryRow, error: delErr } = await this.supabase.db
      .from('sales_order_deliveries')
      .insert({
        shop_id: shopId,
        sales_order_id: orderId,
        number: data.number,
        status: 'completed',
        delivered_at: data.deliveredAt,
        delivered_by: data.deliveredBy,
        sale_id: data.saleId ?? null,
        notes: data.notes ?? null,
        driver_name: data.driverName ?? null,
        vehicle_plate: data.vehiclePlate ?? null,
        remaining_reason: data.remainingReason ?? null,
        created_at: timestamp,
        version: 1,
        sync_status: 'synced',
      })
      .select('*')
      .single();

    if (delErr || !deliveryRow) {
      throw new BadRequestException(
        delErr?.message ?? 'Impossible d’enregistrer la livraison.',
      );
    }

    const deliveryItems = data.items.map((it) => ({
      shop_id: shopId,
      delivery_id: deliveryRow.id,
      sales_order_item_id: it.salesOrderItemId,
      product_id: it.productId,
      quantity_sent: it.quantitySent,
      quantity_accepted: it.quantityAccepted,
      quantity_refused: it.quantityRefused,
      quantity_replaced: it.quantityReplaced ?? 0,
      refusal_reason: it.refusalReason ?? null,
      refusal_destination: it.refusalDestination ?? null,
      replacement_product_id: it.replacementProductId ?? null,
      replacement_unit_price: it.replacementUnitPrice ?? null,
      unit_price: it.unitPrice,
      version: 1,
      sync_status: 'synced',
    }));

    const { error: diErr } = await this.supabase.db
      .from('sales_order_delivery_items')
      .insert(deliveryItems);

    if (diErr) {
      await this.supabase.db
        .from('sales_order_deliveries')
        .delete()
        .eq('id', deliveryRow.id);
      throw new BadRequestException(diErr.message);
    }

    const updatedItems = order.items.map((item) => {
      const line = data.items.find((d) => d.salesOrderItemId === item.id);
      if (!line) return item;
      return {
        ...item,
        quantityDelivered: item.quantityDelivered + line.quantityAccepted,
        quantityRefused: item.quantityRefused + line.quantityRefused,
        quantityReplaced:
          (item.quantityReplaced ?? 0) + (line.quantityReplaced ?? 0),
      };
    });

    for (const item of updatedItems) {
      const line = data.items.find((d) => d.salesOrderItemId === item.id);
      if (!line) continue;
      const { error: upErr } = await this.supabase.db
        .from('sales_order_items')
        .update({
          quantity_delivered: item.quantityDelivered,
          quantity_refused: item.quantityRefused,
          quantity_replaced: item.quantityReplaced ?? 0,
          sync_status: 'synced',
        })
        .eq('id', item.id)
        .eq('shop_id', shopId);
      if (upErr) throw new BadRequestException(upErr.message);
    }

    const nextStatus = computeStatusAfterFulfillment(
      updatedItems,
      order.status === 'confirmed' ? 'preparing' : order.status,
    );

    const nextVersion =
      data.version != null
        ? Math.max(data.version, order.version + 1)
        : order.version + 1;

    const { error: stErr } = await this.supabase.db
      .from('sales_orders')
      .update({
        status: nextStatus,
        updated_at: timestamp,
        updated_by: data.deliveredBy,
        device_id: data.deviceId ?? null,
        version: nextVersion,
        sync_status: 'synced',
      })
      .eq('id', orderId)
      .eq('shop_id', shopId);

    if (stErr) throw new BadRequestException(stErr.message);

    await this.addHistory({
      shopId,
      orderId,
      action: 'delivered',
      performedBy: data.deliveredBy,
      details: `Livraison ${data.number}`,
      payload: data.historyPayload ?? {
        deliveryNumber: data.number,
        remainingReason: data.remainingReason ?? null,
        status: nextStatus,
      },
      ts: timestamp,
    });

    const refreshed = await this.findById(shopId, orderId);
    if (!refreshed) throw new BadRequestException('Commande introuvable');
    return refreshed;
  }

  private async loadDetails(
    shopId: number,
    orderRow: Record<string, unknown>,
    opts?: { includeDeliveries?: boolean },
  ): Promise<SalesOrderEntity> {
    const orderId = orderRow.id as number;
    const includeDeliveries = opts?.includeDeliveries !== false;

    const { data: itemRows, error: itemErr } = await this.supabase.db
      .from('sales_order_items')
      .select('*')
      .eq('shop_id', shopId)
      .eq('sales_order_id', orderId);

    if (itemErr) throw new BadRequestException(itemErr.message);

    const deliveries: SalesOrderDeliveryEntity[] = [];
    if (includeDeliveries) {
      const { data: deliveryRows, error: delErr } = await this.supabase.db
        .from('sales_order_deliveries')
        .select('*')
        .eq('shop_id', shopId)
        .eq('sales_order_id', orderId)
        .order('delivered_at', { ascending: false });

      if (delErr) throw new BadRequestException(delErr.message);

      for (const d of deliveryRows ?? []) {
        const { data: diRows, error: diErr } = await this.supabase.db
          .from('sales_order_delivery_items')
          .select('*')
          .eq('delivery_id', d.id);

        if (diErr) throw new BadRequestException(diErr.message);
        deliveries.push(
          this.mapDelivery(
            d,
            (diRows ?? []).map((r) => this.mapDeliveryItem(r)),
          ),
        );
      }
    }

    return this.mapOrder(
      orderRow,
      (itemRows ?? []).map((r) => this.mapItem(r)),
      deliveries,
    );
  }

  private async addHistory(input: {
    shopId: number;
    orderId: number;
    action: string;
    performedBy: number;
    details?: string;
    payload?: Record<string, unknown> | null;
    ts: number;
  }): Promise<void> {
    const { error } = await this.supabase.db
      .from('sales_order_history_entries')
      .insert({
        shop_id: input.shopId,
        sales_order_id: input.orderId,
        action: input.action,
        performed_by: input.performedBy,
        performed_at: input.ts,
        details: input.details ?? null,
        payload:
          input.payload == null ? null : JSON.stringify(input.payload),
      });
    if (error) throw new BadRequestException(error.message);
  }

  private mapOrder(
    row: Record<string, unknown>,
    items: SalesOrderItemEntity[],
    deliveries: SalesOrderDeliveryEntity[],
  ): SalesOrderEntity {
    return {
      id: row.id as number,
      shopId: row.shop_id as number,
      customerId: row.customer_id as number,
      number: row.number as string,
      status: row.status as SalesOrderStatus,
      orderedAt: row.ordered_at as number,
      subtotal: row.subtotal as number,
      discount: (row.discount as number) ?? 0,
      tax: (row.tax as number) ?? 0,
      total: row.total as number,
      notes: (row.notes as string | null) ?? undefined,
      createdBy: row.created_by as number,
      updatedBy: (row.updated_by as number | null) ?? null,
      deviceId: (row.device_id as string | null) ?? null,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      version: (row.version as number) ?? 1,
      serverId: (row.server_id as string | null) ?? null,
      items,
      deliveries,
    };
  }

  private mapItem(row: Record<string, unknown>): SalesOrderItemEntity {
    return {
      id: row.id as number,
      productId: row.product_id as number,
      quantityOrdered: row.quantity_ordered as number,
      quantityDelivered: (row.quantity_delivered as number) ?? 0,
      quantityRefused: (row.quantity_refused as number) ?? 0,
      quantityReplaced: (row.quantity_replaced as number) ?? 0,
      unitPrice: row.unit_price as number,
      lineTotal: row.line_total as number,
      serverId: (row.server_id as string | null) ?? null,
    };
  }

  private mapDelivery(
    row: Record<string, unknown>,
    items: SalesOrderDeliveryItemEntity[],
  ): SalesOrderDeliveryEntity {
    return {
      id: row.id as number,
      number: row.number as string,
      status: (row.status as string) ?? 'completed',
      deliveredAt: row.delivered_at as number,
      deliveredBy: row.delivered_by as number,
      notes: (row.notes as string | null) ?? undefined,
      driverName: (row.driver_name as string | null) ?? undefined,
      vehiclePlate: (row.vehicle_plate as string | null) ?? undefined,
      remainingReason: (row.remaining_reason as string | null) ?? undefined,
      saleId: (row.sale_id as number | null) ?? null,
      items,
      serverId: (row.server_id as string | null) ?? null,
    };
  }

  private mapDeliveryItem(
    row: Record<string, unknown>,
  ): SalesOrderDeliveryItemEntity {
    return {
      id: row.id as number,
      salesOrderItemId: row.sales_order_item_id as number,
      productId: row.product_id as number,
      quantitySent: row.quantity_sent as number,
      quantityAccepted: row.quantity_accepted as number,
      quantityRefused: (row.quantity_refused as number) ?? 0,
      quantityReplaced: (row.quantity_replaced as number) ?? 0,
      refusalReason: (row.refusal_reason as string | null) ?? undefined,
      refusalDestination:
        (row.refusal_destination as string | null) ?? undefined,
      replacementProductId:
        (row.replacement_product_id as number | null) ?? null,
      replacementUnitPrice:
        (row.replacement_unit_price as number | null) ?? null,
      unitPrice: row.unit_price as number,
    };
  }
}
