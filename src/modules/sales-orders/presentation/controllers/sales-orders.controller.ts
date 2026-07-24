import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { Permission } from '../../../../shared/enums/permission.enum';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantGuard } from '../../../tenants/tenant.guard';
import {
  CancelSalesOrderDto,
  CreateSalesOrderDto,
  DeliverSalesOrderDto,
} from '../../application/dto/sales-order.dto';
import {
  CancelSalesOrderUseCase,
  CloseSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  DeliverSalesOrderUseCase,
  GetSalesOrderUseCase,
  ListSalesOrdersUseCase,
} from '../../application/use-cases/sales-orders.use-cases';

@ApiTags('sales-orders')
@Controller('sales-orders')
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@UseInterceptors(TransformResponseInterceptor)
export class SalesOrdersController {
  constructor(
    private readonly listOrders: ListSalesOrdersUseCase,
    private readonly getOrder: GetSalesOrderUseCase,
    private readonly createOrder: CreateSalesOrderUseCase,
    private readonly confirmOrder: ConfirmSalesOrderUseCase,
    private readonly deliverOrder: DeliverSalesOrderUseCase,
    private readonly cancelOrder: CancelSalesOrderUseCase,
    private readonly closeOrder: CloseSalesOrderUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.SALES_ORDERS_READ)
  @ApiOperation({ summary: 'Lister les commandes clients' })
  @ApiOkResponse()
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query('status') status?: string,
  ) {
    return this.listOrders.execute(String(auth.shopId), status);
  }

  @Get(':id')
  @RequirePermissions(Permission.SALES_ORDERS_READ)
  async get(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.getOrder.execute(String(auth.shopId), id);
  }

  @Post()
  @RequirePermissions(Permission.SALES_ORDERS_WRITE)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateSalesOrderDto,
  ) {
    return this.createOrder.execute(
      String(auth.shopId),
      String(auth.userId),
      dto,
    );
  }

  @Post(':id/confirm')
  @RequirePermissions(Permission.SALES_ORDERS_WRITE)
  async confirm(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.confirmOrder.execute(String(auth.shopId), id);
  }

  @Post(':id/deliver')
  @RequirePermissions(Permission.SALES_ORDERS_DELIVER)
  async deliver(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: DeliverSalesOrderDto,
  ) {
    return this.deliverOrder.execute(String(auth.shopId), id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.SALES_ORDERS_WRITE)
  async cancel(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: CancelSalesOrderDto,
  ) {
    return this.cancelOrder.execute(String(auth.shopId), id, dto);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.SALES_ORDERS_WRITE)
  async close(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.closeOrder.execute(String(auth.shopId), id);
  }
}
