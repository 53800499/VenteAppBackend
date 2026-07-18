import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthorizationGuardsModule } from '../../shared/authorization-guards.module';
import { AuditPersistenceModule } from '../audit/audit-persistence.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ShopsModule } from '../shops/shops.module';
import { UsersModule } from '../users/users.module';
import { StockTransferRepository } from './domain/repositories/stock-transfer.repository';
import { SupabaseStockTransferRepository } from './infrastructure/repositories/supabase-stock-transfer.repository';
import { StockTransfersController } from './presentation/controllers/stock-transfers.controller';
import { TransferDestinationProductService } from './application/services/transfer-destination-product.service';
import {
  ApproveTransferUseCase,
  CancelTransferUseCase,
  CloseTransferUseCase,
  CreateReturnTransferUseCase,
  CreateTransferUseCase,
  GetTransferDetailsUseCase,
  ListIncomingTransfersUseCase,
  ListInTransitTransfersUseCase,
  ListOutgoingTransfersUseCase,
  NextTransferReferenceUseCase,
  ReceiveTransferUseCase,
  ResolveTransferDiscrepancyUseCase,
  ShipTransferUseCase,
  SubmitTransferUseCase,
  ValidateTransferUseCase,
} from './application/use-cases/stock-transfer.use-cases';

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
  controllers: [StockTransfersController],
  providers: [
    { provide: StockTransferRepository, useClass: SupabaseStockTransferRepository },
    TransferDestinationProductService,
    ListOutgoingTransfersUseCase,
    ListIncomingTransfersUseCase,
    ListInTransitTransfersUseCase,
    GetTransferDetailsUseCase,
    CreateTransferUseCase,
    CreateReturnTransferUseCase,
    ValidateTransferUseCase,
    SubmitTransferUseCase,
    ApproveTransferUseCase,
    ShipTransferUseCase,
    ReceiveTransferUseCase,
    CancelTransferUseCase,
    CloseTransferUseCase,
    ResolveTransferDiscrepancyUseCase,
    NextTransferReferenceUseCase,
  ],
  exports: [StockTransferRepository],
})
export class StockTransfersModule {}
