import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { CashSessionsModule } from './modules/cash-sessions/cash-sessions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SalesAnalysisModule } from './modules/sales-analysis/sales-analysis.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditModule } from './modules/audit/audit.module';
import { DebtsModule } from './modules/debts/debts.module';
import { CustomersModule } from './modules/customers/customers.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ShopsModule } from './modules/shops/shops.module';
import { UsersModule } from './modules/users/users.module';

import { CalculatorsModule } from './modules/calculators/calculators.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { StockTransfersModule } from './modules/stock-transfers/stock-transfers.module';

@Module({
  imports: [
    CoreModule,
    TenantsModule,
    AuthModule,
    ShopsModule,
    UsersModule,
    RbacModule,
    DashboardModule,
    InventoryModule,
    SalesModule,
    PaymentsModule,
    CustomersModule,
    DebtsModule,
    ExpensesModule,
    CashSessionsModule,
    ReportsModule,
    SalesAnalysisModule,
    NotificationsModule,
    SettingsModule,
    AuditModule,
    CalculatorsModule,
    PurchasesModule,
    StockTransfersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
