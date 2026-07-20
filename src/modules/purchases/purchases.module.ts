import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditPersistenceModule } from '../audit/audit-persistence.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import { PurchasesRepository } from './domain/repositories/purchases.repository';
import { SupabasePurchasesRepository } from './infrastructure/repositories/supabase-purchases.repository';
import { ProcurementValidationService } from './domain/services/procurement-validation.service';
import { PurchasesController } from './presentation/controllers/purchases.controller';
import {
  CancelPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  CreateSupplierUseCase,
  GetPurchaseOrderDetailsUseCase,
  ListPurchaseOrdersUseCase,
  ListSuppliersUseCase,
  ReceiveItemsUseCase,
  CreateDirectGoodsReceiptUseCase,
  ListDirectGoodsReceiptsUseCase,
  SendPurchaseOrderUseCase,
  UpdatePurchaseOrderUseCase,
  UpdateSupplierUseCase,
  ValidatePurchaseOrderUseCase,
  CreateSupplierInvoiceUseCase,
  RecordSupplierPaymentUseCase,
  ListInvoicesUseCase,
  GetInvoiceDetailsUseCase,
} from './application/use-cases/purchases.use-cases';

@Module({
  imports: [
    CoreModule,
    AuthorizationGuardsModule,
    AuditPersistenceModule,
    InventoryModule,
    ShopsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [PurchasesController],
  providers: [
    { provide: PurchasesRepository, useClass: SupabasePurchasesRepository },
    ProcurementValidationService,
    ListSuppliersUseCase,
    CreateSupplierUseCase,
    UpdateSupplierUseCase,
    ListPurchaseOrdersUseCase,
    GetPurchaseOrderDetailsUseCase,
    CreatePurchaseOrderUseCase,
    UpdatePurchaseOrderUseCase,
    ValidatePurchaseOrderUseCase,
    SendPurchaseOrderUseCase,
    CancelPurchaseOrderUseCase,
    ReceiveItemsUseCase,
    CreateDirectGoodsReceiptUseCase,
    ListDirectGoodsReceiptsUseCase,
    ListInvoicesUseCase,
    GetInvoiceDetailsUseCase,
    CreateSupplierInvoiceUseCase,
    RecordSupplierPaymentUseCase,
  ],
  exports: [PurchasesRepository],
})
export class PurchasesModule {}
