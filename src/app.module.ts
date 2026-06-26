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
import { CustomersModule } from './modules/customers/customers.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ShopsModule } from './modules/shops/shops.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [CoreModule, TenantsModule, AuthModule, ShopsModule, UsersModule, RbacModule, DashboardModule, InventoryModule, SalesModule, PaymentsModule, CustomersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
