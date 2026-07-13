import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { ProductRepository } from '../../../inventory/domain/repositories/product.repository';
import { StockMovementRepository } from '../../../inventory/domain/repositories/stock-movement.repository';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { PurchasesRepository } from '../../domain/repositories/purchases.repository';
import { ProcurementValidationService } from '../../domain/services/procurement-validation.service';
import {
  CreateInvoiceDto,
  CreatePaymentDto,
  CreatePurchaseOrderDto,
  CreateReceiptDto,
  CreateSupplierDto,
  ListPurchaseOrdersQueryDto,
  UpdatePurchaseOrderDto,
  UpdateSupplierDto,
} from '../dto/procurement.dto';
import { PurchaseOrderStatus, SupplierInvoiceStatus } from '../../domain/entities/purchase.entity';

@Injectable()
export class ListSuppliersUseCase {
  constructor(private readonly repo: PurchasesRepository) {}

  execute(auth: AuthContext) {
    return this.repo.listSuppliers(auth.shopId);
  }
}

@Injectable()
export class CreateSupplierUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly validation: ProcurementValidationService,
  ) {}

  async execute(auth: AuthContext, dto: CreateSupplierDto) {
    const name = this.validation.assertNotEmpty(dto.name, 'Nom fournisseur');
    return this.repo.createSupplier(auth.shopId, {
      name,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
    });
  }
}

@Injectable()
export class UpdateSupplierUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly validation: ProcurementValidationService,
  ) {}

  async execute(auth: AuthContext, id: number, dto: UpdateSupplierDto) {
    const supplier = await this.repo.findSupplier(auth.shopId, id);
    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable.');
    }
    return this.repo.updateSupplier(auth.shopId, id, {
      ...(dto.name !== undefined ? { name: this.validation.assertNotEmpty(dto.name, 'Nom fournisseur') } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }
}

@Injectable()
export class ListPurchaseOrdersUseCase {
  constructor(private readonly repo: PurchasesRepository) {}

  execute(auth: AuthContext, query: ListPurchaseOrdersQueryDto) {
    return this.repo.listPurchaseOrders(auth.shopId, {
      supplierId: query.supplierId,
      status: query.status as PurchaseOrderStatus,
      fromMs: query.from,
      toMs: query.to,
    });
  }
}

@Injectable()
export class GetPurchaseOrderDetailsUseCase {
  constructor(private readonly repo: PurchasesRepository) {}

  async execute(auth: AuthContext, id: number) {
    const po = await this.repo.findPurchaseOrder(auth.shopId, id);
    if (!po) {
      throw new NotFoundException('Commande fournisseur introuvable.');
    }
    const history = await this.repo.listHistory(auth.shopId, id);
    const receipts = await this.repo.listReceipts(auth.shopId, id);
    return { ...po, history, receipts };
  }
}

@Injectable()
export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly validation: ProcurementValidationService,
  ) {}

  async execute(auth: AuthContext, dto: CreatePurchaseOrderDto) {
    this.validation.assertNotEmpty(dto.number, 'Numéro de commande');
    this.validation.assertPositive(dto.items.length, 'Nombre d\'articles');

    const supplier = await this.repo.findSupplier(auth.shopId, dto.supplierId);
    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable.');
    }

    const itemsData = dto.items.map((it) => {
      this.validation.assertPositive(it.quantityOrdered, `Quantité pour produit #${it.productId}`);
      this.validation.assertNonNegative(it.unitCost, `Coût unitaire pour produit #${it.productId}`);
      return {
        productId: it.productId,
        quantityOrdered: it.quantityOrdered,
        unitCost: it.unitCost,
        discount: it.discount ?? 0,
        tax: it.tax ?? 0,
        subtotal: it.subtotal,
      };
    });

    const po = await this.repo.createPurchaseOrder(
      auth.shopId,
      {
        supplierId: dto.supplierId,
        number: dto.number,
        orderedAt: dto.orderedAt,
        expectedAt: dto.expectedAt ?? null,
        subtotal: dto.subtotal,
        discount: dto.discount ?? 0,
        tax: dto.tax ?? 0,
        total: dto.total,
        notes: dto.notes ?? null,
        createdBy: auth.userId,
      },
      itemsData,
    );

    await this.repo.addHistory(
      auth.shopId,
      po.id,
      'Commande créée',
      auth.userId,
      'Création initiale de la commande en statut BROUILLON.',
    );

    return po;
  }
}

@Injectable()
export class UpdatePurchaseOrderUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly validation: ProcurementValidationService,
  ) {}

  async execute(auth: AuthContext, id: number, dto: UpdatePurchaseOrderDto) {
    const po = await this.repo.findPurchaseOrder(auth.shopId, id);
    if (!po) {
      throw new NotFoundException('Commande fournisseur introuvable.');
    }

    if (po.status !== 'draft') {
      throw new BadRequestException('Seules les commandes au statut BROUILLON peuvent être modifiées.');
    }

    const itemsData = dto.items
      ? dto.items.map((it) => {
          this.validation.assertPositive(it.quantityOrdered, `Quantité pour produit #${it.productId}`);
          this.validation.assertNonNegative(it.unitCost, `Coût unitaire pour produit #${it.productId}`);
          return {
            productId: it.productId,
            quantityOrdered: it.quantityOrdered,
            unitCost: it.unitCost,
            discount: it.discount ?? 0,
            tax: it.tax ?? 0,
            subtotal: it.subtotal,
          };
        })
      : undefined;

    const updated = await this.repo.updatePurchaseOrder(
      auth.shopId,
      id,
      {
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.orderedAt !== undefined ? { orderedAt: dto.orderedAt } : {}),
        ...(dto.expectedAt !== undefined ? { expectedAt: dto.expectedAt } : {}),
        ...(dto.subtotal !== undefined ? { subtotal: dto.subtotal } : {}),
        ...(dto.discount !== undefined ? { discount: dto.discount } : {}),
        ...(dto.tax !== undefined ? { tax: dto.tax } : {}),
        ...(dto.total !== undefined ? { total: dto.total } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      itemsData,
    );

    await this.repo.addHistory(
      auth.shopId,
      id,
      'Commande modifiée',
      auth.userId,
      'Modification des détails de la commande en statut BROUILLON.',
    );

    return updated;
  }
}

@Injectable()
export class ValidatePurchaseOrderUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly validation: ProcurementValidationService,
  ) {}

  async execute(auth: AuthContext, id: number) {
    const po = await this.repo.findPurchaseOrder(auth.shopId, id);
    if (!po) {
      throw new NotFoundException('Commande fournisseur introuvable.');
    }

    this.validation.validateStatusTransition(po.status, 'validated');

    await this.repo.updatePurchaseOrderStatus(auth.shopId, id, 'validated');
    await this.repo.addHistory(
      auth.shopId,
      id,
      'Commande validée',
      auth.userId,
      'Validation de la commande. Prête pour envoi.',
    );

    return { success: true };
  }
}

@Injectable()
export class SendPurchaseOrderUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly validation: ProcurementValidationService,
  ) {}

  async execute(auth: AuthContext, id: number) {
    const po = await this.repo.findPurchaseOrder(auth.shopId, id);
    if (!po) {
      throw new NotFoundException('Commande fournisseur introuvable.');
    }

    this.validation.validateStatusTransition(po.status, 'sent');

    await this.repo.updatePurchaseOrderStatus(auth.shopId, id, 'sent');
    await this.repo.addHistory(
      auth.shopId,
      id,
      'Commande envoyée',
      auth.userId,
      'La commande a été marquée comme envoyée au fournisseur.',
    );

    return { success: true };
  }
}

@Injectable()
export class CancelPurchaseOrderUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly validation: ProcurementValidationService,
  ) {}

  async execute(auth: AuthContext, id: number, reason?: string) {
    const po = await this.repo.findPurchaseOrder(auth.shopId, id);
    if (!po) {
      throw new NotFoundException('Commande fournisseur introuvable.');
    }

    this.validation.validateStatusTransition(po.status, 'cancelled');

    await this.repo.updatePurchaseOrderStatus(auth.shopId, id, 'cancelled');
    await this.repo.addHistory(
      auth.shopId,
      id,
      'Commande annulée',
      auth.userId,
      reason ?? 'La commande a été annulée.',
    );

    return { success: true };
  }
}

@Injectable()
export class ReceiveItemsUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly products: ProductRepository,
    private readonly stockMovements: StockMovementRepository,
    private readonly validation: ProcurementValidationService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, poId: number, dto: CreateReceiptDto) {
    this.validation.assertNotEmpty(dto.receiptNumber, 'Numéro de bon de réception');
    this.validation.assertPositive(dto.items.length, 'Nombre d\'articles reçus');

    const po = await this.repo.findPurchaseOrder(auth.shopId, poId);
    if (!po) {
      throw new NotFoundException('Commande fournisseur introuvable.');
    }

    if (po.status !== 'sent' && po.status !== 'partially_received') {
      throw new BadRequestException(
        `Impossible de réceptionner sur une commande en statut "${po.status}". La commande doit être envoyée ou partiellement reçue.`,
      );
    }

    const poItems = po.items ?? [];
    const receiptItemsData: any[] = [];

    const timestamp = nowMs();

    for (const item of dto.items) {
      const poItem = poItems.find((pi) => pi.id === item.purchaseOrderItemId);
      if (!poItem) {
        throw new BadRequestException(
          `L'article de commande #${item.purchaseOrderItemId} n'appartient pas à cette commande.`,
        );
      }

      const remainingToReceive = poItem.quantityOrdered - poItem.quantityReceived;
      if (item.quantityReceived > remainingToReceive) {
        throw new BadRequestException(
          `La quantité reçue (${item.quantityReceived}) dépasse la quantité restante à recevoir (${remainingToReceive}) pour le produit #${item.productId}.`,
        );
      }

      const product = await this.products.findByIdAndShop(item.productId, auth.shopId);
      if (!product) {
        throw new NotFoundException(`Produit #${item.productId} introuvable.`);
      }

      receiptItemsData.push({
        purchaseOrderItemId: item.purchaseOrderItemId,
        productId: item.productId,
        quantityReceived: item.quantityReceived,
        unitCost: item.unitCost,
        batchNumber: item.batchNumber ?? null,
        expiryDate: item.expiryDate ?? null,
        product,
        poItem,
      });
    }

    // Record receipt
    const receipt = await this.repo.createReceipt(
      auth.shopId,
      {
        purchaseOrderId: poId,
        receiptNumber: dto.receiptNumber,
        receivedAt: dto.receivedAt,
        receivedBy: auth.userId,
        notes: dto.notes ?? null,
      },
      receiptItemsData.map((ri) => ({
        purchaseOrderItemId: ri.purchaseOrderItemId,
        productId: ri.productId,
        quantityReceived: ri.quantityReceived,
        unitCost: ri.unitCost,
        batchNumber: ri.batchNumber,
        expiryDate: ri.expiryDate,
      })),
    );

    // Apply inventory updates
    for (const ri of receiptItemsData) {
      const quantityBefore = ri.product.quantityInStock;
      const quantityAfter = quantityBefore + ri.quantityReceived;

      // Update product quantity & buying price in database
      await this.products.updateInShop(ri.productId, auth.shopId, {
        quantity_in_stock: quantityAfter,
        price_buy: ri.unitCost, // Update buying price to latest receipt cost
        updated_at: timestamp,
        version: ri.product.version + 1,
      });

      // Create stock movement
      await this.stockMovements.create({
        shop_id: auth.shopId,
        product_id: ri.productId,
        user_id: auth.userId,
        type: 'restock',
        quantity_change: ri.quantityReceived,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        reason: `Réception Commande #${po.number} (BR: ${dto.receiptNumber})`,
        unit_cost: ri.unitCost,
        created_at: timestamp,
      });

      // Audit stock adjustments
      await this.logAudit.execute({
        shopId: auth.shopId,
        userId: auth.userId,
        action: AuditAction.STOCK_ADJUSTED,
        module: AuditModule.PRODUCTS,
        entityId: ri.productId,
        entityTable: 'products',
        oldValue: { quantity_in_stock: quantityBefore },
        newValue: { quantity_in_stock: quantityAfter, movement_type: 'restock' },
        reason: `Réception approvisionnement ${po.number}`,
      });
    }

    // Recheck total received quantities to update PO status
    const refreshedPo = await this.repo.findPurchaseOrder(auth.shopId, poId);
    let allReceived = true;
    for (const pi of refreshedPo?.items ?? []) {
      if (pi.quantityReceived < pi.quantityOrdered) {
        allReceived = false;
        break;
      }
    }

    const nextStatus = allReceived ? 'received' : 'partially_received';
    this.validation.validateStatusTransition(po.status, nextStatus);

    await this.repo.updatePurchaseOrderStatus(auth.shopId, poId, nextStatus);

    const historyDetails = allReceived
      ? `Réception totale via BR #${dto.receiptNumber}. Commande complète.`
      : `Réception partielle via BR #${dto.receiptNumber}.`;

    await this.repo.addHistory(
      auth.shopId,
      poId,
      'Réception',
      auth.userId,
      historyDetails,
    );

    return receipt;
  }
}

@Injectable()
export class CreateSupplierInvoiceUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly validation: ProcurementValidationService,
  ) {}

  async execute(auth: AuthContext, dto: CreateInvoiceDto) {
    this.validation.assertNotEmpty(dto.invoiceNumber, 'Numéro de facture');
    this.validation.assertPositive(dto.total, 'Montant de la facture');

    const supplier = await this.repo.findSupplier(auth.shopId, dto.supplierId);
    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable.');
    }

    if (dto.purchaseOrderId) {
      const po = await this.repo.findPurchaseOrder(auth.shopId, dto.purchaseOrderId);
      if (!po) {
        throw new NotFoundException('Commande fournisseur introuvable.');
      }
    }

    return this.repo.createInvoice(auth.shopId, {
      purchaseOrderId: dto.purchaseOrderId ?? null,
      invoiceNumber: dto.invoiceNumber,
      supplierId: dto.supplierId,
      invoiceDate: dto.invoiceDate,
      dueDate: dto.dueDate ?? null,
      subtotal: dto.subtotal,
      tax: dto.tax ?? 0,
      total: dto.total,
    });
  }
}

@Injectable()
export class RecordSupplierPaymentUseCase {
  constructor(
    private readonly repo: PurchasesRepository,
    private readonly validation: ProcurementValidationService,
  ) {}

  async execute(auth: AuthContext, invoiceId: number, dto: CreatePaymentDto) {
    this.validation.assertPositive(dto.amount, 'Montant du paiement');
    this.validation.validatePaymentMethod(dto.paymentMethod);

    const invoice = await this.repo.findInvoice(auth.shopId, invoiceId);
    if (!invoice) {
      throw new NotFoundException('Facture fournisseur introuvable.');
    }

    if (invoice.status === 'paid') {
      throw new BadRequestException('La facture est déjà entièrement payée.');
    }

    const paidSoFar = await this.repo.sumPaymentsForInvoice(auth.shopId, invoiceId);
    const newPaidTotal = paidSoFar + dto.amount;

    if (newPaidTotal > invoice.total) {
      throw new BadRequestException(
        `Le montant du paiement (${dto.amount}) dépasse le montant restant dû (${invoice.total - paidSoFar}).`,
      );
    }

    const payment = await this.repo.createPayment(auth.shopId, {
      invoiceId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      paymentDate: dto.paymentDate,
      reference: dto.reference ?? null,
    });

    const nextStatus = newPaidTotal >= invoice.total ? 'paid' : 'partially_paid';
    await this.repo.updateInvoiceStatus(auth.shopId, invoiceId, nextStatus);

    if (invoice.purchaseOrderId) {
      await this.repo.addHistory(
        auth.shopId,
        invoice.purchaseOrderId,
        'Paiement',
        auth.userId,
        `Enregistrement d'un paiement de ${dto.amount} FCFA pour la facture ${invoice.invoiceNumber}. Statut facture : ${nextStatus.toUpperCase()}.`,
      );
    }

    return payment;
  }
}

@Injectable()
export class ListInvoicesUseCase {
  constructor(private readonly repo: PurchasesRepository) {}

  execute(auth: AuthContext, supplierId?: number) {
    return this.repo.listInvoices(auth.shopId, supplierId);
  }
}

@Injectable()
export class GetInvoiceDetailsUseCase {
  constructor(private readonly repo: PurchasesRepository) {}

  async execute(auth: AuthContext, id: number) {
    const invoice = await this.repo.findInvoice(auth.shopId, id);
    if (!invoice) {
      throw new NotFoundException('Facture fournisseur introuvable.');
    }
    return invoice;
  }
}
