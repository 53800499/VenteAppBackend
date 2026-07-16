import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditPersistenceModule } from '../audit/audit-persistence.module';
import { AuthModule } from '../auth/auth.module';
import { ShopsModule } from '../shops/shops.module';
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
import {
  ListInventoryLotsUseCase,
  ListProductInventoryLotsUseCase,
} from './application/use-cases/inventory-lot.use-cases';
import { CategoryRepository } from './domain/repositories/category.repository';
import { ProductRepository } from './domain/repositories/product.repository';
import { StockMovementRepository } from './domain/repositories/stock-movement.repository';
import { InventoryLotRepository } from './domain/repositories/inventory-lot.repository';
import { ProductValidationService } from './domain/services/product-validation.service';
import { InventoryLotService } from './domain/services/inventory-lot.service';
import { SupabaseCategoryRepository } from './infrastructure/repositories/category.repository';
import { SupabaseProductRepository } from './infrastructure/repositories/product.repository';
import { SupabaseStockMovementRepository } from './infrastructure/repositories/stock-movement.repository';
import { SupabaseInventoryLotRepository } from './infrastructure/repositories/inventory-lot.repository';
import { CategoriesController } from './presentation/controllers/categories.controller';
import { ProductsController } from './presentation/controllers/products.controller';
import { InventoryLotsController } from './presentation/controllers/inventory-lots.controller';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    AuditPersistenceModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [CategoriesController, ProductsController, InventoryLotsController],
  providers: [
    { provide: CategoryRepository, useClass: SupabaseCategoryRepository },
    { provide: ProductRepository, useClass: SupabaseProductRepository },
    { provide: StockMovementRepository, useClass: SupabaseStockMovementRepository },
    { provide: InventoryLotRepository, useClass: SupabaseInventoryLotRepository },
    ProductValidationService,
    InventoryLotService,
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
    ListInventoryLotsUseCase,
    ListProductInventoryLotsUseCase,
  ],
  exports: [ProductRepository, CategoryRepository, StockMovementRepository, InventoryLotService],
})
export class InventoryModule {}
