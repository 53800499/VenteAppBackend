import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { Category } from '../../domain/entities/category.entity';
import {
  CategoryHasProductsException,
  CategoryInactiveException,
  CategoryNameConflictException,
  CategoryNotFoundException,
} from '../../exceptions/inventory.exceptions';
import { CategoryRepository } from '../../domain/repositories/category.repository';
import { ProductRepository } from '../../domain/repositories/product.repository';

@Injectable()
export class ListCategoriesUseCase {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(auth: AuthContext, activeOnly = false) {
    const rows = await this.categories.findAllByShop(auth.shopId, activeOnly);
    return rows.map((c) => this.toDto(c));
  }

  private toDto(category: Category) {
    return {
      id: category.id,
      name: category.name,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    };
  }
}

@Injectable()
export class CreateCategoryUseCase {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(auth: AuthContext, input: { name: string; sortOrder?: number }) {
    const name = input.name.trim();
    const exists = await this.categories.existsByNameInShop(auth.shopId, name);
    if (exists) {
      throw new CategoryNameConflictException(name);
    }

    const timestamp = nowMs();
    const category = await this.categories.create({
      shop_id: auth.shopId,
      name,
      sort_order: input.sortOrder ?? 0,
      created_at: timestamp,
      updated_at: timestamp,
    });

    return {
      id: category.id,
      name: category.name,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    };
  }
}

@Injectable()
export class UpdateCategoryUseCase {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(
    auth: AuthContext,
    categoryId: number,
    input: { name?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const existing = await this.categories.findByIdAndShop(categoryId, auth.shopId);
    if (!existing) {
      throw new CategoryNotFoundException(categoryId);
    }

    if (input.name != null) {
      const name = input.name.trim();
      const exists = await this.categories.existsByNameInShop(auth.shopId, name, categoryId);
      if (exists) {
        throw new CategoryNameConflictException(name);
      }
    }

    const patch: Record<string, unknown> = { updated_at: nowMs() };
    if (input.name != null) patch.name = input.name.trim();
    if (input.isActive != null) patch.is_active = input.isActive;
    if (input.sortOrder != null) patch.sort_order = input.sortOrder;

    const updated = await this.categories.updateInShop(categoryId, auth.shopId, patch);
    return {
      id: updated.id,
      name: updated.name,
      isActive: updated.isActive,
      sortOrder: updated.sortOrder,
    };
  }
}

@Injectable()
export class DeleteCategoryUseCase {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly products: ProductRepository,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, categoryId: number) {
    const existing = await this.categories.findByIdAndShop(categoryId, auth.shopId);
    if (!existing) {
      throw new CategoryNotFoundException(categoryId);
    }

    const productCount = await this.products.countByCategoryInShop(categoryId, auth.shopId);
    if (productCount > 0) {
      throw new CategoryHasProductsException(categoryId, productCount);
    }

    await this.categories.deleteInShop(categoryId, auth.shopId);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.CATEGORY_DELETED,
      module: AuditModule.PRODUCTS,
      entityId: categoryId,
      entityTable: 'categories',
      oldValue: { name: existing.name, is_active: existing.isActive },
      newValue: null,
      reason: 'Suppression catégorie vide',
    });

    return { id: categoryId, deleted: true };
  }
}

export async function assertActiveCategory(
  categories: CategoryRepository,
  shopId: number,
  categoryId: number,
) {
  const category = await categories.findByIdAndShop(categoryId, shopId);
  if (!category) {
    throw new CategoryNotFoundException(categoryId);
  }
  if (!category.isActive) {
    throw new CategoryInactiveException(categoryId);
  }
  return category;
}
