import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { Product } from '../../domain/entities/product.entity';
import { CategoryRepository } from '../../domain/repositories/category.repository';
import { ProductRepository } from '../../domain/repositories/product.repository';
import { StockMovementRepository } from '../../domain/repositories/stock-movement.repository';
import { ProductValidationService } from '../../domain/services/product-validation.service';
import {
  ProductAlreadyArchivedException,
  ProductDeletionBlockedException,
  ProductNotFoundException,
} from '../../exceptions/inventory.exceptions';
import { assertActiveCategory } from './category.use-cases';
import { ProductSortQuery } from '../dto/product.dto';

@Injectable()
export class ListProductsUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly validation: ProductValidationService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    auth: AuthContext,
    filters: {
      categoryId?: number;
      search?: string;
      lowStock?: boolean;
      includeArchived?: boolean;
      sort?: ProductSortQuery;
    } = {},
  ) {
    const defaultThreshold = this.configService.get<number>('dashboard.defaultAlertThreshold', 5);
    const rows = await this.products.listByShop(auth.shopId, {
      categoryId: filters.categoryId,
      search: filters.search,
      lowStockOnly: filters.lowStock,
      includeArchived: filters.includeArchived,
      sort: filters.sort,
      defaultAlertThreshold: defaultThreshold,
    });
    return rows.map((p) => this.toDto(p, defaultThreshold));
  }

  toDto(product: Product, defaultThreshold: number) {
    const threshold = product.alertThreshold ?? defaultThreshold;
    return {
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      sku: product.sku,
      quantityInStock: product.quantityInStock,
      alertThreshold: threshold,
      priceBuy: product.priceBuy,
      priceSell: product.priceSell,
      isArchived: product.isArchived,
      isLowStock: !product.isArchived && product.quantityInStock <= threshold,
    };
  }
}

@Injectable()
export class ListLowStockProductsUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly listProducts: ListProductsUseCase,
    private readonly configService: ConfigService,
  ) {}

  async execute(auth: AuthContext) {
    const defaultThreshold = this.configService.get<number>('dashboard.defaultAlertThreshold', 5);
    const rows = await this.products.listLowStock(auth.shopId, defaultThreshold);
    return rows.map((p) => this.listProducts.toDto(p, defaultThreshold));
  }
}

@Injectable()
export class GetProductUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly listProducts: ListProductsUseCase,
    private readonly configService: ConfigService,
  ) {}

  async execute(auth: AuthContext, productId: number) {
    const product = await this.products.findByIdAndShop(productId, auth.shopId);
    if (!product) {
      throw new ProductNotFoundException(productId);
    }
    const defaultThreshold = this.configService.get<number>('dashboard.defaultAlertThreshold', 5);
    return this.listProducts.toDto(product, defaultThreshold);
  }
}

@Injectable()
export class CreateProductUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly stockMovements: StockMovementRepository,
    private readonly validation: ProductValidationService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    auth: AuthContext,
    input: {
      name: string;
      categoryId: number;
      sku?: string;
      priceSell: number;
      priceBuy?: number;
      initialQuantity: number;
      alertThreshold?: number;
    },
  ) {
    this.validation.validateName(input.name);
    this.validation.validatePrices({ priceSell: input.priceSell, priceBuy: input.priceBuy });
    this.validation.validateInitialQuantity(input.initialQuantity);

    await assertActiveCategory(this.categories, auth.shopId, input.categoryId);

    const defaultThreshold = this.configService.get<number>('dashboard.defaultAlertThreshold', 5);
    const alertThreshold = this.validation.resolveAlertThreshold(input.alertThreshold, defaultThreshold);
    const timestamp = nowMs();

    const product = await this.products.create({
      shop_id: auth.shopId,
      category_id: input.categoryId,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      quantity_in_stock: input.initialQuantity,
      alert_threshold: alertThreshold,
      price_buy: input.priceBuy ?? null,
      price_sell: input.priceSell,
      created_at: timestamp,
      updated_at: timestamp,
    });

    if (input.initialQuantity > 0) {
      await this.stockMovements.create({
        shop_id: auth.shopId,
        product_id: product.id,
        user_id: auth.userId,
        type: 'initial',
        quantity_change: input.initialQuantity,
        quantity_before: 0,
        quantity_after: input.initialQuantity,
        reason: 'Stock initial à la création',
        created_at: timestamp,
      });
    }

    return {
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      quantityInStock: product.quantityInStock,
      alertThreshold,
      priceSell: product.priceSell,
      priceBuy: product.priceBuy,
    };
  }
}

@Injectable()
export class UpdateProductUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly validation: ProductValidationService,
    private readonly logAudit: LogAuditUseCase,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    auth: AuthContext,
    productId: number,
    input: {
      name?: string;
      categoryId?: number;
      sku?: string;
      priceSell?: number;
      priceBuy?: number | null;
      alertThreshold?: number;
    },
  ) {
    const existing = await this.products.findByIdAndShop(productId, auth.shopId);
    if (!existing) {
      throw new ProductNotFoundException(productId);
    }
    if (existing.isArchived) {
      throw new ProductAlreadyArchivedException(productId);
    }

    if (input.name != null) {
      this.validation.validateName(input.name);
    }

    const nextPriceSell = input.priceSell ?? existing.priceSell;
    const nextPriceBuy = input.priceBuy !== undefined ? input.priceBuy : existing.priceBuy;
    if (input.priceSell != null || input.priceBuy !== undefined) {
      this.validation.validatePrices({ priceSell: nextPriceSell, priceBuy: nextPriceBuy });
    }

    if (input.categoryId != null) {
      await assertActiveCategory(this.categories, auth.shopId, input.categoryId);
    }

    const defaultThreshold = this.configService.get<number>('dashboard.defaultAlertThreshold', 5);
    const patch: Record<string, unknown> = {
      updated_at: nowMs(),
      version: existing.version + 1,
    };

    if (input.name != null) patch.name = input.name.trim();
    if (input.categoryId != null) patch.category_id = input.categoryId;
    if (input.sku !== undefined) patch.sku = input.sku?.trim() || null;
    if (input.priceSell != null) patch.price_sell = input.priceSell;
    if (input.priceBuy !== undefined) patch.price_buy = input.priceBuy;
    if (input.alertThreshold != null) {
      patch.alert_threshold = this.validation.resolveAlertThreshold(input.alertThreshold, defaultThreshold);
    }

    const updated = await this.products.updateInShop(productId, auth.shopId, patch);

    const priceChanged =
      updated.priceSell !== existing.priceSell ||
      updated.priceBuy !== existing.priceBuy;

    if (priceChanged) {
      await this.logAudit.execute({
        shopId: auth.shopId,
        userId: auth.userId,
        action: AuditAction.PRODUCT_PRICE_CHANGED,
        module: AuditModule.PRODUCTS,
        entityId: productId,
        entityTable: 'products',
        oldValue: { price_sell: existing.priceSell, price_buy: existing.priceBuy },
        newValue: { price_sell: updated.priceSell, price_buy: updated.priceBuy },
        reason: 'Modification des prix produit',
      });
    }

    return {
      id: updated.id,
      name: updated.name,
      categoryId: updated.categoryId,
      priceSell: updated.priceSell,
      priceBuy: updated.priceBuy,
      alertThreshold: updated.alertThreshold ?? defaultThreshold,
    };
  }
}

@Injectable()
export class ArchiveProductUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, productId: number) {
    const existing = await this.products.findByIdAndShop(productId, auth.shopId);
    if (!existing) {
      throw new ProductNotFoundException(productId);
    }
    if (existing.isArchived) {
      throw new ProductAlreadyArchivedException(productId);
    }

    const timestamp = nowMs();
    await this.products.updateInShop(productId, auth.shopId, {
      is_archived: true,
      updated_at: timestamp,
      version: existing.version + 1,
    });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.PRODUCT_ARCHIVED,
      module: AuditModule.PRODUCTS,
      entityId: productId,
      entityTable: 'products',
      oldValue: { is_archived: false, name: existing.name },
      newValue: { is_archived: true },
      reason: 'Archivage produit (RG-INV-07/08)',
    });

    return { id: productId, archived: true };
  }
}

@Injectable()
export class DeleteProductUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, productId: number) {
    const existing = await this.products.findByIdAndShop(productId, auth.shopId);
    if (!existing) {
      throw new ProductNotFoundException(productId);
    }

    const saleItemCount = await this.products.countSaleItems(productId, auth.shopId);
    if (saleItemCount > 0) {
      throw new ProductDeletionBlockedException(productId, saleItemCount);
    }

    await this.products.deleteInShop(productId, auth.shopId);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.PRODUCT_DELETED,
      module: AuditModule.PRODUCTS,
      entityId: productId,
      entityTable: 'products',
      oldValue: {
        name: existing.name,
        category_id: existing.categoryId,
        quantity_in_stock: existing.quantityInStock,
        is_archived: existing.isArchived,
      },
      newValue: null,
      reason: 'Suppression définitive (aucune vente liée — RG-INV-07)',
    });

    return { id: productId, deleted: true };
  }
}
