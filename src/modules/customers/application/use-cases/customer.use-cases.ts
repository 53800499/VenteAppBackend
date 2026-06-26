import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { Customer } from '../../domain/entities/customer.entity';
import { CustomerRepository } from '../../domain/repositories/customer.repository';
import { CustomerValidationService } from '../../domain/services/customer-validation.service';
import {
  CustomerAlreadyArchivedException,
  CustomerDebtReminderNoPhoneException,
  CustomerNotFoundException,
} from '../../exceptions/customers.exceptions';

const CRITICAL_DEBT_MS = 30 * 24 * 60 * 60 * 1000;

function toCustomerDto(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    note: customer.note,
    isArchived: customer.isArchived,
    balanceDue: customer.balanceDue,
    openDebtsCount: customer.openDebtsCount,
    purchaseCount: customer.purchaseCount,
    totalPurchases: customer.totalPurchases,
    lastActivityAt: customer.lastActivityAt,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

@Injectable()
export class ListCustomersUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly validation: CustomerValidationService,
  ) {}

  async execute(
    auth: AuthContext,
    filters?: {
      search?: string;
      includeArchived?: boolean;
      hasDebt?: boolean;
      sort?: 'name' | 'debt' | 'lastActivity';
      limit?: number;
    },
  ) {
    const rows = await this.customers.listByShop(auth.shopId, filters);
    return rows.map((c) => ({
      ...toCustomerDto(c),
      phoneWarning: this.validation.phoneWarning(c.phone),
    }));
  }
}

@Injectable()
export class ListDebtorsUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(auth: AuthContext) {
    const debtors = await this.customers.listDebtors(auth.shopId);
    const now = nowMs();
    const mapped = debtors.map((d) => ({
      customerId: d.customerId,
      customerName: d.customerName,
      phone: d.phone,
      balanceDue: d.balanceDue,
      openDebtsCount: d.openDebtsCount,
      oldestDebtAt: d.oldestDebtAt,
      isCritical: now - d.oldestDebtAt >= CRITICAL_DEBT_MS,
    }));
    return {
      totalDebt: mapped.reduce((sum, d) => sum + d.balanceDue, 0),
      debtorCount: mapped.length,
      debtors: mapped,
    };
  }
}

@Injectable()
export class GetCustomerUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly validation: CustomerValidationService,
  ) {}

  async execute(auth: AuthContext, customerId: number) {
    const customer = await this.customers.findByIdAndShop(customerId, auth.shopId);
    if (!customer) throw new CustomerNotFoundException(customerId);

    const recentSales = await this.customers.listSales(customerId, auth.shopId, 10);
    return {
      ...toCustomerDto(customer),
      phoneWarning: this.validation.phoneWarning(customer.phone),
      recentSales: recentSales.map((s) => ({
        id: s.id,
        receiptNumber: s.receiptNumber,
        totalAmount: s.totalAmount,
        status: s.status,
        createdAt: s.createdAt,
      })),
    };
  }
}

@Injectable()
export class ListCustomerSalesUseCase {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(auth: AuthContext, customerId: number, limit = 50) {
    const customer = await this.customers.findByIdAndShop(customerId, auth.shopId);
    if (!customer) throw new CustomerNotFoundException(customerId);

    const sales = await this.customers.listSales(customerId, auth.shopId, limit);
    return sales.map((s) => ({
      id: s.id,
      receiptNumber: s.receiptNumber,
      totalAmount: s.totalAmount,
      status: s.status,
      createdAt: s.createdAt,
    }));
  }
}

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly validation: CustomerValidationService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, input: { name: string; phone?: string; note?: string }) {
    const name = this.validation.assertName(input.name);
    const timestamp = nowMs();

    const customer = await this.customers.create({
      shop_id: auth.shopId,
      name,
      phone: input.phone?.trim() || null,
      note: input.note?.trim() || null,
      created_at: timestamp,
      updated_at: timestamp,
    });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.CUSTOMER_CREATED,
      module: AuditModule.CUSTOMERS,
      entityId: customer.id,
      entityTable: 'customers',
      newValue: { name: customer.name, phone: customer.phone },
      reason: 'Client créé',
    });

    return {
      ...toCustomerDto(customer),
      phoneWarning: this.validation.phoneWarning(customer.phone),
    };
  }
}

@Injectable()
export class UpdateCustomerUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly validation: CustomerValidationService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(
    auth: AuthContext,
    customerId: number,
    input: { name?: string; phone?: string; note?: string },
  ) {
    const existing = await this.customers.findByIdAndShop(customerId, auth.shopId);
    if (!existing) throw new CustomerNotFoundException(customerId);
    if (existing.isArchived) throw new CustomerAlreadyArchivedException(customerId);

    const patch: Record<string, unknown> = { updated_at: nowMs() };
    if (input.name != null) patch.name = this.validation.assertName(input.name);
    if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
    if (input.note !== undefined) patch.note = input.note.trim() || null;

    const updated = await this.customers.updateInShop(customerId, auth.shopId, patch);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.CUSTOMER_UPDATED,
      module: AuditModule.CUSTOMERS,
      entityId: customerId,
      entityTable: 'customers',
      oldValue: { name: existing.name, phone: existing.phone, note: existing.note },
      newValue: { name: updated.name, phone: updated.phone, note: updated.note },
      reason: 'Fiche client mise à jour',
    });

    return {
      ...toCustomerDto(updated),
      phoneWarning: this.validation.phoneWarning(updated.phone),
    };
  }
}

@Injectable()
export class ArchiveCustomerUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly validation: CustomerValidationService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, customerId: number) {
    const existing = await this.customers.findByIdAndShop(customerId, auth.shopId);
    if (!existing) throw new CustomerNotFoundException(customerId);
    if (existing.isArchived) throw new CustomerAlreadyArchivedException(customerId);

    const openDebts = await this.customers.countOpenDebts(customerId, auth.shopId);
    this.validation.assertCanArchive(openDebts);

    const timestamp = nowMs();
    await this.customers.archive(customerId, auth.shopId, timestamp);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.CUSTOMER_ARCHIVED,
      module: AuditModule.CUSTOMERS,
      entityId: customerId,
      entityTable: 'customers',
      oldValue: { isArchived: false },
      newValue: { isArchived: true },
      reason: 'Client archivé',
    });

    return { id: customerId, archived: true };
  }
}

@Injectable()
export class GetDebtReminderUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly shops: ShopRepository,
    private readonly validation: CustomerValidationService,
  ) {}

  async execute(auth: AuthContext, customerId: number) {
    const customer = await this.customers.findByIdAndShop(customerId, auth.shopId);
    if (!customer) throw new CustomerNotFoundException(customerId);
    if (!customer.phone?.trim()) throw new CustomerDebtReminderNoPhoneException();
    if (customer.balanceDue <= 0) {
      return {
        customerId,
        customerName: customer.name,
        balanceDue: 0,
        message: `Bonjour ${customer.name}, merci pour votre fidélité.`,
        whatsappUrl: this.validation.buildWhatsappUrl(
          customer.phone,
          `Bonjour ${customer.name}, merci pour votre fidélité.`,
        ),
      };
    }

    const shop = await this.shops.findShopById(auth.shopId);
    const shopName = shop?.name ?? 'notre boutique';
    const message =
      `Bonjour ${customer.name}, ` +
      `vous avez un solde de ${customer.balanceDue.toLocaleString('fr-FR')} FCFA chez ${shopName}. ` +
      `Merci de régulariser votre situation.`;

    return {
      customerId,
      customerName: customer.name,
      balanceDue: customer.balanceDue,
      message,
      whatsappUrl: this.validation.buildWhatsappUrl(customer.phone, message),
    };
  }
}
