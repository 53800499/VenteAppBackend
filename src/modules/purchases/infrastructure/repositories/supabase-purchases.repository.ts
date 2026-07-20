import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { PurchasesRepository, CreateSupplierData, UpdateSupplierData, CreatePurchaseOrderData, CreatePurchaseOrderItemData, UpdatePurchaseOrderData, CreateReceiptData, CreateReceiptItemData, CreateInvoiceData, CreatePaymentData, ListPurchaseOrdersFilters } from '../../domain/repositories/purchases.repository';
import { Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, SupplierInvoice, SupplierPayment, PurchaseOrderHistory, PurchaseOrderStatus, SupplierInvoiceStatus, PurchasePaymentMethod } from '../../domain/entities/purchase.entity';
import { nowMs } from '../../../../shared/utils/time.util';

@Injectable()
export class SupabasePurchasesRepository extends PurchasesRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  // ---------------------------------------------------------------------------
  // Suppliers
  // ---------------------------------------------------------------------------
  async listSuppliers(shopId: number): Promise<Supplier[]> {
    const { data, error } = await this.supabase.db
      .from('suppliers')
      .select('*')
      .eq('shop_id', shopId)
      .order('name', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map(this.mapSupplier);
  }

  async findSupplier(shopId: number, id: number): Promise<Supplier | null> {
    const { data, error } = await this.supabase.db
      .from('suppliers')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data ? this.mapSupplier(data) : null;
  }

  async createSupplier(shopId: number, data: CreateSupplierData): Promise<Supplier> {
    const timestamp = nowMs();
    const { data: row, error } = await this.supabase.db
      .from('suppliers')
      .insert({
        shop_id: shopId,
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
        sync_status: 'synced',
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible de créer le fournisseur.');
    }
    return this.mapSupplier(row);
  }

  async updateSupplier(shopId: number, id: number, data: UpdateSupplierData): Promise<Supplier> {
    const timestamp = nowMs();
    const updateData: Record<string, any> = {
      updated_at: timestamp,
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: row, error } = await this.supabase.db
      .from('suppliers')
      .update(updateData)
      .eq('shop_id', shopId)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible de modifier le fournisseur.');
    }
    return this.mapSupplier(row);
  }

  // ---------------------------------------------------------------------------
  // Purchase Orders
  // ---------------------------------------------------------------------------
  async listPurchaseOrders(shopId: number, filters?: ListPurchaseOrdersFilters): Promise<PurchaseOrder[]> {
    let query = this.supabase.db
      .from('purchase_orders')
      .select(`
        *,
        suppliers ( name )
      `)
      .eq('shop_id', shopId);

    if (filters?.supplierId) {
      query = query.eq('supplier_id', filters.supplierId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.fromMs) {
      query = query.gte('ordered_at', filters.fromMs);
    }
    if (filters?.toMs) {
      query = query.lte('ordered_at', filters.toMs);
    }

    query = query.order('ordered_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => this.mapPurchaseOrder(row));
  }

  async findPurchaseOrder(shopId: number, id: number): Promise<PurchaseOrder | null> {
    const { data: poRow, error: poErr } = await this.supabase.db
      .from('purchase_orders')
      .select(`
        *,
        suppliers ( name ),
        users ( name )
      `)
      .eq('shop_id', shopId)
      .eq('id', id)
      .maybeSingle();

    if (poErr) throw new BadRequestException(poErr.message);
    if (!poRow) return null;

    const { data: itemRows, error: itemErr } = await this.supabase.db
      .from('purchase_order_items')
      .select(`
        *,
        products ( name )
      `)
      .eq('shop_id', shopId)
      .eq('purchase_order_id', id);

    if (itemErr) throw new BadRequestException(itemErr.message);

    const items = (itemRows ?? []).map((row) => this.mapPurchaseOrderItem(row));
    return this.mapPurchaseOrder(poRow, items);
  }

  async createPurchaseOrder(
    shopId: number,
    data: CreatePurchaseOrderData,
    items: CreatePurchaseOrderItemData[],
  ): Promise<PurchaseOrder> {
    const timestamp = nowMs();
    
    // Insert PO
    const { data: poRow, error: poErr } = await this.supabase.db
      .from('purchase_orders')
      .insert({
        shop_id: shopId,
        supplier_id: data.supplierId,
        number: data.number,
        status: 'draft',
        ordered_at: data.orderedAt,
        expected_at: data.expectedAt ?? null,
        subtotal: data.subtotal,
        discount: data.discount ?? 0,
        tax: data.tax ?? 0,
        total: data.total,
        notes: data.notes ?? null,
        created_by: data.createdBy,
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
        sync_status: 'synced',
      })
      .select('*')
      .single();

    if (poErr || !poRow) {
      throw new BadRequestException(poErr?.message ?? 'Impossible de créer la commande.');
    }

    // Insert Items
    const itemsToInsert = items.map((it) => ({
      shop_id: shopId,
      purchase_order_id: poRow.id,
      product_id: it.productId,
      quantity_ordered: it.quantityOrdered,
      quantity_received: 0,
      unit_cost: it.unitCost,
      discount: it.discount ?? 0,
      tax: it.tax ?? 0,
      subtotal: it.subtotal,
      version: 1,
      sync_status: 'synced',
    }));

    const { data: itemRows, error: itemErr } = await this.supabase.db
      .from('purchase_order_items')
      .insert(itemsToInsert)
      .select('*');

    if (itemErr) {
      // Cleanup PO
      await this.supabase.db.from('purchase_orders').delete().eq('id', poRow.id);
      throw new BadRequestException(itemErr.message);
    }

    return this.mapPurchaseOrder(
      poRow,
      (itemRows ?? []).map((row) => this.mapPurchaseOrderItem(row)),
    );
  }

  async updatePurchaseOrder(
    shopId: number,
    id: number,
    data: UpdatePurchaseOrderData,
    items?: CreatePurchaseOrderItemData[],
  ): Promise<PurchaseOrder> {
    const timestamp = nowMs();
    const updateData: Record<string, any> = {
      updated_at: timestamp,
    };
    if (data.supplierId !== undefined) updateData.supplier_id = data.supplierId;
    if (data.number !== undefined) updateData.number = data.number;
    if (data.orderedAt !== undefined) updateData.ordered_at = data.orderedAt;
    if (data.expectedAt !== undefined) updateData.expected_at = data.expectedAt;
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.discount !== undefined) updateData.discount = data.discount;
    if (data.tax !== undefined) updateData.tax = data.tax;
    if (data.total !== undefined) updateData.total = data.total;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const { data: poRow, error: poErr } = await this.supabase.db
      .from('purchase_orders')
      .update(updateData)
      .eq('shop_id', shopId)
      .eq('id', id)
      .select('*')
      .single();

    if (poErr || !poRow) {
      throw new BadRequestException(poErr?.message ?? 'Impossible de modifier la commande.');
    }

    if (items) {
      // Recreate items
      const deleteErr = await this.supabase.db
        .from('purchase_order_items')
        .delete()
        .eq('shop_id', shopId)
        .eq('purchase_order_id', id);

      if (deleteErr.error) throw new BadRequestException(deleteErr.error.message);

      const itemsToInsert = items.map((it) => ({
        shop_id: shopId,
        purchase_order_id: id,
        product_id: it.productId,
        quantity_ordered: it.quantityOrdered,
        quantity_received: 0,
        unit_cost: it.unitCost,
        discount: it.discount ?? 0,
        tax: it.tax ?? 0,
        subtotal: it.subtotal,
        version: 1,
        sync_status: 'synced',
      }));

      const { data: itemRows, error: itemErr } = await this.supabase.db
        .from('purchase_order_items')
        .insert(itemsToInsert)
        .select('*');

      if (itemErr) throw new BadRequestException(itemErr.message);

      return this.mapPurchaseOrder(
        poRow,
        (itemRows ?? []).map((row) => this.mapPurchaseOrderItem(row)),
      );
    }

    // Retrieve existing items
    const { data: itemRows, error: itemErr } = await this.supabase.db
      .from('purchase_order_items')
      .select(`
        *,
        products ( name )
      `)
      .eq('shop_id', shopId)
      .eq('purchase_order_id', id);

    if (itemErr) throw new BadRequestException(itemErr.message);

    return this.mapPurchaseOrder(
      poRow,
      (itemRows ?? []).map((row) => this.mapPurchaseOrderItem(row)),
    );
  }

  async updatePurchaseOrderStatus(shopId: number, id: number, status: PurchaseOrderStatus): Promise<void> {
    const timestamp = nowMs();
    const { data: current, error: readErr } = await this.supabase.db
      .from('purchase_orders')
      .select('version')
      .eq('shop_id', shopId)
      .eq('id', id)
      .maybeSingle();
    if (readErr) throw new BadRequestException(readErr.message);

    const nextVersion = ((current?.version as number | undefined) ?? 1) + 1;
    const { error } = await this.supabase.db
      .from('purchase_orders')
      .update({
        status,
        updated_at: timestamp,
        version: nextVersion,
      })
      .eq('shop_id', shopId)
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------
  async addHistory(shopId: number, poId: number, action: string, userId: number, details?: string | null): Promise<void> {
    const timestamp = nowMs();
    const { error } = await this.supabase.db
      .from('purchase_order_history')
      .insert({
        shop_id: shopId,
        purchase_order_id: poId,
        action,
        performed_by: userId,
        performed_at: timestamp,
        details: details ?? null,
      });

    if (error) throw new BadRequestException(error.message);
  }

  async listHistory(shopId: number, poId: number): Promise<PurchaseOrderHistory[]> {
    const { data, error } = await this.supabase.db
      .from('purchase_order_history')
      .select(`
        *,
        users ( name )
      `)
      .eq('shop_id', shopId)
      .eq('purchase_order_id', poId)
      .order('performed_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      shopId: row.shop_id,
      purchaseOrderId: row.purchase_order_id,
      action: row.action,
      performedBy: row.performed_by,
      performedByName: row.users?.name ?? null,
      performedAt: row.performed_at,
      details: row.details,
    }));
  }

  // ---------------------------------------------------------------------------
  // Receipts
  // ---------------------------------------------------------------------------
  async createReceipt(
    shopId: number,
    data: CreateReceiptData,
    items: CreateReceiptItemData[],
  ): Promise<PurchaseReceipt> {
    const timestamp = nowMs();

    // Insert Receipt
    const { data: recRow, error: recErr } = await this.supabase.db
      .from('purchase_receipts')
      .insert({
        shop_id: shopId,
        purchase_order_id: data.purchaseOrderId,
        supplier_id: data.supplierId,
        receipt_type: data.receiptType,
        receipt_number: data.receiptNumber,
        received_at: data.receivedAt,
        received_by: data.receivedBy,
        notes: data.notes ?? null,
        version: 1,
        sync_status: 'synced',
      })
      .select('*')
      .single();

    if (recErr || !recRow) {
      throw new BadRequestException(recErr?.message ?? 'Impossible d\'enregistrer le bon de réception.');
    }

    // Insert Receipt Items
    const recItemsToInsert = items.map((it) => ({
      shop_id: shopId,
      purchase_receipt_id: recRow.id,
      purchase_order_item_id: it.purchaseOrderItemId ?? null,
      product_id: it.productId,
      quantity_received: it.quantityReceived,
      unit_cost: it.unitCost,
      batch_number: it.batchNumber ?? null,
      expiry_date: it.expiryDate ?? null,
      version: 1,
      sync_status: 'synced',
    }));

    const { data: recItemRows, error: recItemErr } = await this.supabase.db
      .from('purchase_receipt_items')
      .insert(recItemsToInsert)
      .select('*');

    if (recItemErr) {
      // Cleanup receipt
      await this.supabase.db.from('purchase_receipts').delete().eq('id', recRow.id);
      throw new BadRequestException(recItemErr.message);
    }

    // Update quantities in PurchaseOrderItems (commande uniquement)
    for (const item of items) {
      if (item.purchaseOrderItemId == null) continue;

      const { data: curPoItem, error: fetchErr } = await this.supabase.db
        .from('purchase_order_items')
        .select('quantity_received')
        .eq('id', item.purchaseOrderItemId)
        .single();
      
      if (fetchErr) throw new BadRequestException(fetchErr.message);

      const newReceivedTotal = (curPoItem?.quantity_received ?? 0) + item.quantityReceived;

      const { error: updErr } = await this.supabase.db
        .from('purchase_order_items')
        .update({
          quantity_received: newReceivedTotal,
        })
        .eq('id', item.purchaseOrderItemId);

      if (updErr) throw new BadRequestException(updErr.message);
    }

    return {
      id: recRow.id,
      shopId: recRow.shop_id,
      purchaseOrderId: recRow.purchase_order_id,
      supplierId: recRow.supplier_id,
      receiptType: recRow.receipt_type ?? 'from_order',
      receiptNumber: recRow.receipt_number,
      receivedAt: recRow.received_at,
      receivedBy: recRow.received_by,
      notes: recRow.notes,
      version: recRow.version,
      serverId: recRow.server_id,
      items: (recItemRows ?? []).map((row) => ({
        id: row.id,
        shopId: row.shop_id,
        purchaseReceiptId: row.purchase_receipt_id,
        purchaseOrderItemId: row.purchase_order_item_id,
        productId: row.product_id,
        quantityReceived: row.quantity_received,
        unitCost: Number(row.unit_cost),
        batchNumber: row.batch_number,
        expiryDate: row.expiry_date,
        version: row.version,
        serverId: row.server_id,
      })),
    };
  }

  async listReceipts(shopId: number, poId: number): Promise<PurchaseReceipt[]> {
    const { data: recRows, error: recErr } = await this.supabase.db
      .from('purchase_receipts')
      .select(`
        *,
        users ( name )
      `)
      .eq('shop_id', shopId)
      .eq('purchase_order_id', poId)
      .order('received_at', { ascending: false });

    if (recErr) throw new BadRequestException(recErr.message);

    const receipts: PurchaseReceipt[] = [];

    for (const recRow of recRows ?? []) {
      const { data: recItemRows, error: recItemErr } = await this.supabase.db
        .from('purchase_receipt_items')
        .select(`
          *,
          products ( name )
        `)
        .eq('shop_id', shopId)
        .eq('purchase_receipt_id', recRow.id);

      if (recItemErr) throw new BadRequestException(recItemErr.message);

      receipts.push({
        id: recRow.id,
        shopId: recRow.shop_id,
        purchaseOrderId: recRow.purchase_order_id,
        supplierId: recRow.supplier_id,
        receiptType: recRow.receipt_type ?? 'from_order',
        receiptNumber: recRow.receipt_number,
        receivedAt: recRow.received_at,
        receivedBy: recRow.received_by,
        receivedByName: recRow.users?.name ?? null,
        notes: recRow.notes,
        version: recRow.version,
        serverId: recRow.server_id,
        items: (recItemRows ?? []).map((row) => ({
          id: row.id,
          shopId: row.shop_id,
          purchaseReceiptId: row.purchase_receipt_id,
          purchaseOrderItemId: row.purchase_order_item_id,
          productId: row.product_id,
          productName: row.products?.name ?? null,
          quantityReceived: row.quantity_received,
          unitCost: Number(row.unit_cost),
          batchNumber: row.batch_number,
          expiryDate: row.expiry_date,
          version: row.version,
          serverId: row.server_id,
        })),
      });
    }

    return receipts;
  }

  async listDirectReceipts(shopId: number): Promise<PurchaseReceipt[]> {
    const { data: recRows, error: recErr } = await this.supabase.db
      .from('purchase_receipts')
      .select(`
        *,
        users ( name )
      `)
      .eq('shop_id', shopId)
      .eq('receipt_type', 'direct')
      .is('purchase_order_id', null)
      .order('received_at', { ascending: false });

    if (recErr) throw new BadRequestException(recErr.message);

    const receipts: PurchaseReceipt[] = [];

    for (const recRow of recRows ?? []) {
      const { data: recItemRows, error: recItemErr } = await this.supabase.db
        .from('purchase_receipt_items')
        .select(`
          *,
          products ( name )
        `)
        .eq('shop_id', shopId)
        .eq('purchase_receipt_id', recRow.id);

      if (recItemErr) throw new BadRequestException(recItemErr.message);

      receipts.push({
        id: recRow.id,
        shopId: recRow.shop_id,
        purchaseOrderId: recRow.purchase_order_id,
        supplierId: recRow.supplier_id,
        receiptType: recRow.receipt_type ?? 'direct',
        receiptNumber: recRow.receipt_number,
        receivedAt: recRow.received_at,
        receivedBy: recRow.received_by,
        receivedByName: recRow.users?.name ?? null,
        notes: recRow.notes,
        version: recRow.version,
        serverId: recRow.server_id,
        items: (recItemRows ?? []).map((row) => ({
          id: row.id,
          shopId: row.shop_id,
          purchaseReceiptId: row.purchase_receipt_id,
          purchaseOrderItemId: row.purchase_order_item_id,
          productId: row.product_id,
          productName: row.products?.name ?? null,
          quantityReceived: row.quantity_received,
          unitCost: Number(row.unit_cost),
          batchNumber: row.batch_number,
          expiryDate: row.expiry_date,
          version: row.version,
          serverId: row.server_id,
        })),
      });
    }

    return receipts;
  }

  // ---------------------------------------------------------------------------
  // Invoices & Payments
  // ---------------------------------------------------------------------------
  async createInvoice(shopId: number, data: CreateInvoiceData): Promise<SupplierInvoice> {
    const timestamp = nowMs();
    const { data: row, error } = await this.supabase.db
      .from('supplier_invoices')
      .insert({
        shop_id: shopId,
        purchase_order_id: data.purchaseOrderId ?? null,
        invoice_number: data.invoiceNumber,
        supplier_id: data.supplierId,
        invoice_date: data.invoiceDate,
        due_date: data.dueDate ?? null,
        subtotal: data.subtotal,
        tax: data.tax ?? 0,
        total: data.total,
        status: 'unpaid',
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
        sync_status: 'synced',
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible de créer la facture.');
    }
    return this.mapSupplierInvoice(row);
  }

  async findInvoice(shopId: number, id: number): Promise<SupplierInvoice | null> {
    const { data: row, error } = await this.supabase.db
      .from('supplier_invoices')
      .select(`
        *,
        suppliers ( name )
      `)
      .eq('shop_id', shopId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!row) return null;

    const { data: payRows, error: payErr } = await this.supabase.db
      .from('supplier_payments')
      .select('*')
      .eq('shop_id', shopId)
      .eq('invoice_id', id);

    if (payErr) throw new BadRequestException(payErr.message);

    const payments = (payRows ?? []).map(this.mapSupplierPayment);
    return this.mapSupplierInvoice(row, payments);
  }

  async listInvoices(shopId: number, supplierId?: number): Promise<SupplierInvoice[]> {
    let query = this.supabase.db
      .from('supplier_invoices')
      .select(`
        *,
        suppliers ( name )
      `)
      .eq('shop_id', shopId);

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    query = query.order('invoice_date', { ascending: false });

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => this.mapSupplierInvoice(row));
  }

  async createPayment(shopId: number, data: CreatePaymentData): Promise<SupplierPayment> {
    const timestamp = nowMs();
    const { data: row, error } = await this.supabase.db
      .from('supplier_payments')
      .insert({
        shop_id: shopId,
        invoice_id: data.invoiceId,
        amount: data.amount,
        payment_method: data.paymentMethod,
        payment_date: data.paymentDate,
        reference: data.reference ?? null,
        created_at: timestamp,
        version: 1,
        sync_status: 'synced',
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new BadRequestException(error?.message ?? 'Impossible d\'enregistrer le paiement.');
    }
    return this.mapSupplierPayment(row);
  }

  async updateInvoiceStatus(shopId: number, invoiceId: number, status: SupplierInvoiceStatus): Promise<void> {
    const timestamp = nowMs();
    const { error } = await this.supabase.db
      .from('supplier_invoices')
      .update({
        status,
        updated_at: timestamp,
      })
      .eq('shop_id', shopId)
      .eq('id', invoiceId);

    if (error) throw new BadRequestException(error.message);
  }

  async sumPaymentsForInvoice(shopId: number, invoiceId: number): Promise<number> {
    const { data, error } = await this.supabase.db
      .from('supplier_payments')
      .select('amount')
      .eq('shop_id', shopId)
      .eq('invoice_id', invoiceId);

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).reduce((acc, row) => acc + Number(row.amount), 0);
  }

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------
  private mapSupplier(row: any): Supplier {
    return {
      id: row.id,
      shopId: row.shop_id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      serverId: row.server_id,
    };
  }

  private mapPurchaseOrder(row: any, items?: PurchaseOrderItem[]): PurchaseOrder {
    return {
      id: row.id,
      shopId: row.shop_id,
      supplierId: row.supplier_id,
      supplierName: row.suppliers?.name ?? null,
      number: row.number,
      status: row.status as PurchaseOrderStatus,
      orderedAt: row.ordered_at,
      expectedAt: row.expected_at,
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      tax: Number(row.tax),
      total: Number(row.total),
      notes: row.notes,
      createdBy: row.created_by,
      createdByName: row.users?.name ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      serverId: row.server_id,
      items,
    };
  }

  private mapPurchaseOrderItem(row: any): PurchaseOrderItem {
    return {
      id: row.id,
      shopId: row.shop_id,
      purchaseOrderId: row.purchase_order_id,
      productId: row.product_id,
      productName: row.products?.name ?? null,
      quantityOrdered: row.quantity_ordered,
      quantityReceived: row.quantity_received,
      unitCost: Number(row.unit_cost),
      discount: Number(row.discount),
      tax: Number(row.tax),
      subtotal: Number(row.subtotal),
      version: row.version,
      serverId: row.server_id,
    };
  }

  private mapSupplierInvoice(row: any, payments?: SupplierPayment[]): SupplierInvoice {
    return {
      id: row.id,
      shopId: row.shop_id,
      purchaseOrderId: row.purchase_order_id,
      invoiceNumber: row.invoice_number,
      supplierId: row.supplier_id,
      supplierName: row.suppliers?.name ?? null,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      subtotal: Number(row.subtotal),
      tax: Number(row.tax),
      total: Number(row.total),
      status: row.status as SupplierInvoiceStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      serverId: row.server_id,
      payments,
    };
  }

  private mapSupplierPayment(row: any): SupplierPayment {
    return {
      id: row.id,
      shopId: row.shop_id,
      invoiceId: row.invoice_id,
      amount: Number(row.amount),
      paymentMethod: row.payment_method as PurchasePaymentMethod,
      paymentDate: row.payment_date,
      reference: row.reference,
      createdAt: row.created_at,
      version: row.version,
      serverId: row.server_id,
    };
  }
}
