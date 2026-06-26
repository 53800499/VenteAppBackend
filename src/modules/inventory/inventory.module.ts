import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
} from './application/use-cases/category.use-cases';
import {
  ArchiveProductUseCase,
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListLowStockProductsUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from './application/use-cases/product.use-cases';
import {
  AdjustProductStockUseCase,
  ListProductStockMovementsUseCase,
} from './application/use-cases/stock.use-cases';
import { CategoryRepository } from './domain/repositories/category.repository';
import { ProductRepository } from './domain/repositories/product.repository';
import { StockMovementRepository } from './domain/repositories/stock-movement.repository';
import { ProductValidationService } from './domain/services/product-validation.service';
import { SupabaseCategoryRepository } from './infrastructure/repositories/category.repository';
import { SupabaseProductRepository } from './infrastructure/repositories/product.repository';
import { SupabaseStockMovementRepository } from './infrastructure/repositories/stock-movement.repository';
import { CategoriesController } from './presentation/controllers/categories.controller';
import { ProductsController } from './presentation/controllers/products.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    AuditModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [CategoriesController, ProductsController],
  providers: [
    { provide: CategoryRepository, useClass: SupabaseCategoryRepository },
    { provide: ProductRepository, useClass: SupabaseProductRepository },
    { provide: StockMovementRepository, useClass: SupabaseStockMovementRepository },
    ProductValidationService,
    ListCategoriesUseCase,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
    ListProductsUseCase,
    ListLowStockProductsUseCase,
    GetProductUseCase,
    CreateProductUseCase,
    UpdateProductUseCase,
    ArchiveProductUseCase,
    DeleteProductUseCase,
    AdjustProductStockUseCase,
    ListProductStockMovementsUseCase,
  ],
  exports: [ProductRepository, CategoryRepository, StockMovementRepository],
})
export class InventoryModule {}
