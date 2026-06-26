import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { StockMovementType } from '../../domain/entities/stock-movement.entity';
import { ProductRepository } from '../../domain/repositories/product.repository';
import { StockMovementRepository } from '../../domain/repositories/stock-movement.repository';
import { ProductValidationService } from '../../domain/services/product-validation.service';
import { ProductNotFoundException } from '../../exceptions/inventory.exceptions';
import { StockAdjustmentTypeDto } from '../dto/product.dto';

const RECENT_MOVEMENTS_LIMIT = 10;

@Injectable()
export class AdjustProductStockUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly stockMovements: StockMovementRepository,
    private readonly validation: ProductValidationService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(
    auth: AuthContext,
    productId: number,
    input: {
      type: StockAdjustmentTypeDto;
      quantityChange: number;
      reason?: string;
      unitCost?: number;
    },
  ) {
    const product = await this.products.findByIdAndShop(productId, auth.shopId);
    if (!product) {
      throw new ProductNotFoundException(productId);
    }
    if (product.isArchived) {
      throw new ProductNotFoundException(productId);
    }

    if (input.quantityChange === 0) {
      return { id: productId, quantityInStock: product.quantityInStock, unchanged: true };
    }

    const movementType = input.type as StockMovementType;
    const { quantityBefore, quantityAfter } = this.validation.validateStockAdjustment(
      movementType,
      product.quantityInStock,
      input.quantityChange,
      input.reason,
    );

    const timestamp = nowMs();
    await this.products.updateInShop(productId, auth.shopId, {
      quantity_in_stock: quantityAfter,
      updated_at: timestamp,
      version: product.version + 1,
    });

    const movement = await this.stockMovements.create({
      shop_id: auth.shopId,
      product_id: productId,
      user_id: auth.userId,
      type: movementType,
      quantity_change: input.quantityChange,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      reason: input.reason?.trim() || null,
      unit_cost: input.type === StockAdjustmentTypeDto.RESTOCK ? input.unitCost ?? null : null,
      created_at: timestamp,
    });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.STOCK_ADJUSTED,
      module: AuditModule.PRODUCTS,
      entityId: productId,
      entityTable: 'products',
      oldValue: { quantity_in_stock: quantityBefore },
      newValue: { quantity_in_stock: quantityAfter, movement_type: movementType },
      reason: input.reason ?? `Ajustement stock (${movementType})`,
    });

    return {
      id: productId,
      quantityInStock: quantityAfter,
      movement: {
        id: movement.id,
        type: movement.type,
        quantityChange: movement.quantityChange,
        quantityBefore: movement.quantityBefore,
        quantityAfter: movement.quantityAfter,
        createdAt: movement.createdAt,
      },
    };
  }
}

@Injectable()
export class ListProductStockMovementsUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly stockMovements: StockMovementRepository,
  ) {}

  async execute(auth: AuthContext, productId: number) {
    const product = await this.products.findByIdAndShop(productId, auth.shopId);
    if (!product) {
      throw new ProductNotFoundException(productId);
    }

    const rows = await this.stockMovements.findRecentByProduct(
      productId,
      auth.shopId,
      RECENT_MOVEMENTS_LIMIT,
    );

    return rows.map((m) => ({
      id: m.id,
      type: m.type,
      quantityChange: m.quantityChange,
      quantityBefore: m.quantityBefore,
      quantityAfter: m.quantityAfter,
      reason: m.reason,
      userId: m.userId,
      createdAt: m.createdAt,
    }));
  }
}
