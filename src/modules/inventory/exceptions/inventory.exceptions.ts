import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../../shared/enums/error-code.enum';
import { DomainException } from '../../../shared/exceptions/domain.exception';

export class ProductNotFoundException extends DomainException {
  constructor(productId: number) {
    super(
      ErrorCode.INV_PRODUCT_NOT_FOUND,
      'Produit introuvable dans cette boutique.',
      HttpStatus.NOT_FOUND,
      { productId },
    );
  }
}

export class CategoryNotFoundException extends DomainException {
  constructor(categoryId: number) {
    super(
      ErrorCode.INV_CATEGORY_NOT_FOUND,
      'Catégorie introuvable dans cette boutique.',
      HttpStatus.NOT_FOUND,
      { categoryId },
    );
  }
}

export class CategoryInactiveException extends DomainException {
  constructor(categoryId: number) {
    super(
      ErrorCode.INV_CATEGORY_INACTIVE,
      'La catégorie sélectionnée est inactive.',
      HttpStatus.BAD_REQUEST,
      { categoryId },
      'Choisissez une catégorie active ou réactivez-la.',
    );
  }
}

export class CategoryNameConflictException extends DomainException {
  constructor(name: string) {
    super(
      ErrorCode.INV_CATEGORY_NAME_CONFLICT,
      `Une catégorie « ${name} » existe déjà.`,
      HttpStatus.CONFLICT,
      { name },
    );
  }
}

export class InvalidProductNameException extends DomainException {
  constructor() {
    super(
      ErrorCode.INV_INVALID_PRODUCT_NAME,
      'Le nom du produit est obligatoire (min. 2 caractères).',
      HttpStatus.BAD_REQUEST,
      undefined,
      'RG-INV-01',
    );
  }
}

export class InvalidProductPriceException extends DomainException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorCode.INV_INVALID_PRICE,
      message,
      HttpStatus.BAD_REQUEST,
      details,
      'RG-INV-02 / RG-INV-03',
    );
  }
}

export class InvalidStockQuantityException extends DomainException {
  constructor(message: string) {
    super(
      ErrorCode.INV_INVALID_STOCK,
      message,
      HttpStatus.BAD_REQUEST,
      undefined,
      'RG-INV-04',
    );
  }
}

export class NegativeStockException extends DomainException {
  constructor(currentStock: number, change: number) {
    super(
      ErrorCode.INV_NEGATIVE_STOCK,
      'Stock insuffisant — opération refusée.',
      HttpStatus.BAD_REQUEST,
      { currentStock, change },
      'RG-INV-11',
    );
  }
}

export class StockReasonRequiredException extends DomainException {
  constructor(type: string) {
    super(
      ErrorCode.INV_REASON_REQUIRED,
      `Un motif est obligatoire pour un ajustement de type « ${type} ».`,
      HttpStatus.BAD_REQUEST,
      { type },
      'RG-INV-10',
    );
  }
}

export class ProductAlreadyArchivedException extends DomainException {
  constructor(productId: number) {
    super(
      ErrorCode.INV_PRODUCT_ALREADY_ARCHIVED,
      'Ce produit est déjà archivé.',
      HttpStatus.CONFLICT,
      { productId },
    );
  }
}

export class ProductDeletionBlockedException extends DomainException {
  constructor(productId: number, saleItemCount?: number) {
    super(
      ErrorCode.INV_PRODUCT_DELETE_HAS_SALES,
      'Ce produit ne peut pas être supprimé car il est lié à des ventes.',
      HttpStatus.CONFLICT,
      { productId, saleItemCount },
      'Utilisez PATCH /api/products/:id/archive pour l\'archiver (RG-INV-07).',
    );
  }
}

export class CategoryHasProductsException extends DomainException {
  constructor(categoryId: number, productCount: number) {
    super(
      ErrorCode.INV_CATEGORY_HAS_PRODUCTS,
      'Cette catégorie contient des produits et ne peut pas être supprimée.',
      HttpStatus.CONFLICT,
      { categoryId, productCount },
      'Désactivez la catégorie (PATCH isActive: false) ou réaffectez les produits.',
    );
  }
}
