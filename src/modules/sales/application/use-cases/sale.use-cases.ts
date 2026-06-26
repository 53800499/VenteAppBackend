import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { ProductNotFoundException } from '../../../inventory/exceptions/inventory.exceptions';
import { ProductRepository } from '../../../inventory/domain/repositories/product.repository';
import { StockMovementRepository } from '../../../inventory/domain/repositories/stock-movement.repository';
import { Sale } from '../../domain/entities/sale.entity';
import {
  SaleCustomerRepository,
  SaleDebtRepository,
  SaleRepository,
} from '../../domain/repositories/sale.repository';
import { ReceiptNumberService } from '../../domain/services/receipt-number.service';
import { PaymentDraft, PaymentInput, SaleLineDraft, SaleValidationService } from '../../domain/services/sale-validation.service';
import {
  SaleAlreadyCancelledException,
  SaleCancelDebtPartialException,
  SaleNotFoundException,
  SaleOwnerOnlyCancelException,
} from '../../exceptions/sales.exceptions';

function toPaymentDraft(payment: PaymentInput): PaymentDraft {
  return {
    method: payment.method,
    amountCash: payment.amountCash ?? 0,
    amountMomo: payment.amountMomo ?? 0,
    amountCredit: payment.amountCredit ?? 0,
  };
}

function toSaleResponse(sale: Sale) {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    saleType: sale.saleType,
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    totalAmount: sale.totalAmount,
    amountPaid: sale.amountPaid,
    amountCash: sale.amountCash,
    amountMomo: sale.amountMomo,
    amountCredit: sale.amountCredit,
    paymentMethod: sale.paymentMethod,
    status: sale.status,
    customerId: sale.customerId,
    userId: sale.userId,
    note: sale.note,
    createdAt: sale.createdAt,
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  };
}

@Injectable()
export class CreateStandardSaleUseCase {
  constructor(
    private readonly sales: SaleRepository,
    private readonly products: ProductRepository,
    private readonly stockMovements: StockMovementRepository,
    private readonly customers: SaleCustomerRepository,
    private readonly debts: SaleDebtRepository,
    private readonly validation: SaleValidationService,
    private readonly receipts: ReceiptNumberService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(
    auth: AuthContext,
    input: {
      items: { productId: number; quantity: number; unitPrice?: number; lineDiscountAmount?: number }[];
      discountAmount?: number;
      customerId?: number;
      payment: PaymentInput;
      note?: string;
    },
  ) {
    const lines: SaleLineDraft[] = input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? 0,
      lineDiscountAmount: item.lineDiscountAmount ?? 0,
    }));

    this.validation.assertStandardCart(lines);

    const productSnapshots: {
      product: Awaited<ReturnType<ProductRepository['findByIdAndShop']>>;
      line: SaleLineDraft;
    }[] = [];

    for (const line of lines) {
      const product = await this.products.findByIdAndShop(line.productId, auth.shopId);
      if (!product || product.isArchived) {
        throw new ProductNotFoundException(line.productId);
      }
      const unitPrice = line.unitPrice > 0 ? line.unitPrice : product.priceSell;
      line.unitPrice = unitPrice;
      this.validation.assertStockAvailable(product.name, product.quantityInStock, line.quantity);
      productSnapshots.push({ product: product!, line });
    }

    const payment = toPaymentDraft(input.payment);
    const totals = this.validation.computeTotals(lines, input.discountAmount ?? 0, payment);
    this.validation.assertCustomerForCredit(input.customerId, totals.amountCredit);

    if (input.customerId) {
      const customer = await this.customers.findByIdAndShop(input.customerId, auth.shopId);
      if (!customer) {
        throw new NotFoundException('Client introuvable dans cette boutique.');
      }
    }

    const timestamp = nowMs();
    const receiptNumber = await this.receipts.generate(auth.shopId, timestamp);

    const saleItems = productSnapshots.map(({ product, line }) => ({
      product_id: product!.id,
      product_name: product!.name,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      unit_cost: product!.priceBuy,
      discount_amount: line.lineDiscountAmount,
      line_total: this.validation.computeLineTotal(line),
    }));

    const sale = await this.sales.createWithItems(
      {
        shop_id: auth.shopId,
        receipt_number: receiptNumber,
        customer_id: input.customerId ?? null,
        user_id: auth.userId,
        sale_type: 'standard',
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        total_amount: totals.totalAmount,
        amount_paid: totals.amountPaid,
        amount_cash: totals.amountCash,
        amount_momo: totals.amountMomo,
        amount_credit: totals.amountCredit,
        payment_method: payment.method,
        status: 'completed',
        note: input.note ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      },
      saleItems,
    );

    for (const { product, line } of productSnapshots) {
      const quantityBefore = product!.quantityInStock;
      const quantityAfter = quantityBefore - line.quantity;
      await this.products.updateInShop(product!.id, auth.shopId, {
        quantity_in_stock: quantityAfter,
        updated_at: timestamp,
        version: product!.version + 1,
      });
      await this.stockMovements.create({
        shop_id: auth.shopId,
        product_id: product!.id,
        user_id: auth.userId,
        type: 'sale',
        quantity_change: -line.quantity,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        sale_id: sale.id,
        created_at: timestamp,
      });
    }

    if (totals.amountCredit > 0 && input.customerId) {
      const debt = await this.debts.create({
        shop_id: auth.shopId,
        customer_id: input.customerId,
        sale_id: sale.id,
        user_id: auth.userId,
        original_amount: totals.amountCredit,
        amount_paid: 0,
        amount_remaining: totals.amountCredit,
        status: 'open',
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
      });

      await this.logAudit.execute({
        shopId: auth.shopId,
        userId: auth.userId,
        action: AuditAction.DEBT_CREATED,
        module: AuditModule.DEBTS,
        entityId: debt.id,
        entityTable: 'debts',
        newValue: {
          saleId: sale.id,
          customerId: input.customerId,
          originalAmount: totals.amountCredit,
        },
        reason: 'Dette créée lors de la vente à crédit',
      });
    }

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SALE_CREATED,
      module: AuditModule.SALES,
      entityId: sale.id,
      entityTable: 'sales',
      newValue: { receiptNumber, totalAmount: totals.totalAmount, saleType: 'standard' },
      reason: 'Vente standard enregistrée',
    });

    return toSaleResponse(sale);
  }
}

@Injectable()
export class CreateQuickSaleUseCase {
  constructor(
    private readonly sales: SaleRepository,
    private readonly validation: SaleValidationService,
    private readonly receipts: ReceiptNumberService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(
    auth: AuthContext,
    input: { totalAmount: number; payment: PaymentInput; note?: string },
  ) {
    const payment = toPaymentDraft(input.payment);
    const totals = this.validation.computeQuickTotals(input.totalAmount, payment);
    const timestamp = nowMs();
    const receiptNumber = await this.receipts.generate(auth.shopId, timestamp);

    const sale = await this.sales.createWithItems(
      {
        shop_id: auth.shopId,
        receipt_number: receiptNumber,
        customer_id: null,
        user_id: auth.userId,
        sale_type: 'quick',
        subtotal: totals.subtotal,
        discount_amount: 0,
        total_amount: totals.totalAmount,
        amount_paid: totals.amountPaid,
        amount_cash: totals.amountCash,
        amount_momo: totals.amountMomo,
        amount_credit: 0,
        payment_method: payment.method,
        status: 'completed',
        note: input.note ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      },
      [],
    );

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SALE_CREATED,
      module: AuditModule.SALES,
      entityId: sale.id,
      entityTable: 'sales',
      newValue: { receiptNumber, totalAmount: totals.totalAmount, saleType: 'quick' },
      reason: 'Vente rapide enregistrée (sans impact stock)',
    });

    return toSaleResponse(sale);
  }
}

@Injectable()
export class ListSalesUseCase {
  constructor(private readonly sales: SaleRepository) {}

  async execute(
    auth: AuthContext,
    filters?: {
      status?: string;
      saleType?: string;
      customerId?: number;
      from?: number;
      to?: number;
      limit?: number;
    },
  ) {
    const rows = await this.sales.listByShop(auth.shopId, {
      status: filters?.status as never,
      saleType: filters?.saleType as never,
      customerId: filters?.customerId,
      from: filters?.from,
      to: filters?.to,
      limit: filters?.limit ?? 50,
    });

    return rows.map((sale) => ({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      saleType: sale.saleType,
      totalAmount: sale.totalAmount,
      status: sale.status,
      createdAt: sale.createdAt,
    }));
  }
}

@Injectable()
export class GetSaleUseCase {
  constructor(private readonly sales: SaleRepository) {}

  async execute(auth: AuthContext, saleId: number) {
    const sale = await this.sales.findByIdAndShop(saleId, auth.shopId);
    if (!sale) throw new SaleNotFoundException(saleId);
    return toSaleResponse(sale);
  }
}

@Injectable()
export class CancelSaleUseCase {
  constructor(
    private readonly sales: SaleRepository,
    private readonly products: ProductRepository,
    private readonly stockMovements: StockMovementRepository,
    private readonly debts: SaleDebtRepository,
    private readonly validation: SaleValidationService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, saleId: number, reason: string) {
    if (auth.role !== UserRole.OWNER) {
      throw new SaleOwnerOnlyCancelException();
    }

    const sale = await this.sales.findByIdAndShop(saleId, auth.shopId);
    if (!sale) throw new SaleNotFoundException(saleId);
    if (sale.status === 'cancelled') throw new SaleAlreadyCancelledException(saleId);

    const now = nowMs();
    this.validation.assertCancelWindow(sale.createdAt, now);

    const debt = await this.debts.findBySaleId(saleId, auth.shopId);
    if (debt && debt.amountPaid > 0) {
      throw new SaleCancelDebtPartialException();
    }

    if (sale.saleType === 'standard') {
      for (const item of sale.items) {
        if (!item.productId) continue;
        const product = await this.products.findByIdAndShop(item.productId, auth.shopId);
        if (!product) continue;
        const quantityBefore = product.quantityInStock;
        const quantityAfter = quantityBefore + item.quantity;
        await this.products.updateInShop(product.id, auth.shopId, {
          quantity_in_stock: quantityAfter,
          updated_at: now,
          version: product.version + 1,
        });
        await this.stockMovements.create({
          shop_id: auth.shopId,
          product_id: product.id,
          user_id: auth.userId,
          type: 'sale_cancel',
          quantity_change: item.quantity,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          sale_id: sale.id,
          reason,
          created_at: now,
        });
      }
    }

    if (debt) {
      await this.debts.closeBySaleId(saleId, auth.shopId, now);
    }

    await this.sales.cancel(saleId, auth.shopId, {
      cancel_reason: reason,
      cancelled_by_user_id: auth.userId,
      cancelled_at: now,
      updated_at: now,
      version: sale.version + 1,
    });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SALE_CANCELLED,
      module: AuditModule.SALES,
      entityId: saleId,
      entityTable: 'sales',
      oldValue: {
        status: sale.status,
        totalAmount: sale.totalAmount,
        receiptNumber: sale.receiptNumber,
      },
      newValue: { status: 'cancelled' },
      reason,
    });

    return { id: saleId, cancelled: true, receiptNumber: sale.receiptNumber };
  }
}
