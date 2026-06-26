import { DeleteCategoryUseCase } from './category.use-cases';
import { DeleteProductUseCase } from './product.use-cases';
import { Category } from '../../domain/entities/category.entity';
import { Product } from '../../domain/entities/product.entity';
import {
  CategoryHasProductsException,
  CategoryNotFoundException,
  ProductDeletionBlockedException,
  ProductNotFoundException,
} from '../../exceptions/inventory.exceptions';
import { CategoryRepository } from '../../domain/repositories/category.repository';
import { ProductRepository } from '../../domain/repositories/product.repository';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';

const auth = { shopId: 1, userId: 1, role: 'owner' as const, permissions: [] };

const sampleProduct = new Product(
  12, 1, 1, 'Riz 25kg', null, 50, 5, 12000, 15000, false, 0, 0, 1,
);

const sampleCategory = new Category(1, 1, 'Boissons', true, 0, 0, 0);

function mockProductRepo(overrides: Partial<ProductRepository> = {}): ProductRepository {
  return {
    findByIdAndShop: jest.fn(),
    listByShop: jest.fn(),
    listLowStock: jest.fn(),
    create: jest.fn(),
    updateInShop: jest.fn(),
    hasSaleItems: jest.fn(),
    countSaleItems: jest.fn(),
    countByCategoryInShop: jest.fn(),
    deleteInShop: jest.fn(),
    ...overrides,
  } as ProductRepository;
}

function mockCategoryRepo(overrides: Partial<CategoryRepository> = {}): CategoryRepository {
  return {
    findAllByShop: jest.fn(),
    findByIdAndShop: jest.fn(),
    existsByNameInShop: jest.fn(),
    create: jest.fn(),
    updateInShop: jest.fn(),
    deleteInShop: jest.fn(),
    ...overrides,
  } as CategoryRepository;
}

const mockAudit: LogAuditUseCase = { execute: jest.fn() } as unknown as LogAuditUseCase;

describe('DeleteProductUseCase (RG-INV-07)', () => {
  it('supprime un produit sans ventes liées', async () => {
    const products = mockProductRepo({
      findByIdAndShop: jest.fn().mockResolvedValue(sampleProduct),
      countSaleItems: jest.fn().mockResolvedValue(0),
      deleteInShop: jest.fn().mockResolvedValue(undefined),
    });
    const useCase = new DeleteProductUseCase(products, mockAudit);

    const result = await useCase.execute(auth as never, 12);

    expect(result).toEqual({ id: 12, deleted: true });
    expect(products.deleteInShop).toHaveBeenCalledWith(12, 1);
    expect(mockAudit.execute).toHaveBeenCalled();
  });

  it('refuse la suppression si des ventes sont liées', async () => {
    const products = mockProductRepo({
      findByIdAndShop: jest.fn().mockResolvedValue(sampleProduct),
      countSaleItems: jest.fn().mockResolvedValue(3),
    });
    const useCase = new DeleteProductUseCase(products, mockAudit);

    await expect(useCase.execute(auth as never, 12)).rejects.toThrow(ProductDeletionBlockedException);
    expect(products.deleteInShop).not.toHaveBeenCalled();
  });

  it('lève une erreur si produit introuvable', async () => {
    const products = mockProductRepo({
      findByIdAndShop: jest.fn().mockResolvedValue(null),
    });
    const useCase = new DeleteProductUseCase(products, mockAudit);

    await expect(useCase.execute(auth as never, 99)).rejects.toThrow(ProductNotFoundException);
  });
});

describe('DeleteCategoryUseCase', () => {
  it('supprime une catégorie sans produits', async () => {
    const categories = mockCategoryRepo({
      findByIdAndShop: jest.fn().mockResolvedValue(sampleCategory),
      deleteInShop: jest.fn().mockResolvedValue(undefined),
    });
    const products = mockProductRepo({
      countByCategoryInShop: jest.fn().mockResolvedValue(0),
    });
    const useCase = new DeleteCategoryUseCase(categories, products, mockAudit);

    const result = await useCase.execute(auth as never, 1);

    expect(result).toEqual({ id: 1, deleted: true });
    expect(categories.deleteInShop).toHaveBeenCalledWith(1, 1);
  });

  it('refuse si des produits sont rattachés', async () => {
    const categories = mockCategoryRepo({
      findByIdAndShop: jest.fn().mockResolvedValue(sampleCategory),
    });
    const products = mockProductRepo({
      countByCategoryInShop: jest.fn().mockResolvedValue(5),
    });
    const useCase = new DeleteCategoryUseCase(categories, products, mockAudit);

    await expect(useCase.execute(auth as never, 1)).rejects.toThrow(CategoryHasProductsException);
    expect(categories.deleteInShop).not.toHaveBeenCalled();
  });

  it('lève une erreur si catégorie introuvable', async () => {
    const categories = mockCategoryRepo({
      findByIdAndShop: jest.fn().mockResolvedValue(null),
    });
    const products = mockProductRepo();
    const useCase = new DeleteCategoryUseCase(categories, products, mockAudit);

    await expect(useCase.execute(auth as never, 99)).rejects.toThrow(CategoryNotFoundException);
  });
});
