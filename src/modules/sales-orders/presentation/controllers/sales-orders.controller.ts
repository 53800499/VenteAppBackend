import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
  SalesOrderVersionDto,
} from '../../application/dto/sales-order.dto';
import {
  CancelSalesOrderUseCase,
  CloseSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  DeliverSalesOrderUseCase,
  GetSalesOrderUseCase,
  ListSalesOrdersUseCase,
  PrepareSalesOrderUseCase,
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
    private readonly prepareOrder: PrepareSalesOrderUseCase,
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
    @Query('updatedAfter') updatedAfterRaw?: string,
  ) {
    const updatedAfter =
      updatedAfterRaw != null && updatedAfterRaw !== ''
        ? Number(updatedAfterRaw)
        : undefined;
    return this.listOrders.execute(
      auth.shopId,
      status,
      Number.isFinite(updatedAfter) ? updatedAfter : undefined,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.SALES_ORDERS_READ)
  async get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.getOrder.execute(auth.shopId, id);
  }

  @Post()
  @RequirePermissions(Permission.SALES_ORDERS_WRITE)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateSalesOrderDto,
  ) {
    return this.createOrder.execute(auth.shopId, auth.userId, dto);
  }

  @Post(':id/confirm')
  @RequirePermissions(Permission.SALES_ORDERS_WRITE)
  async confirm(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalesOrderVersionDto,
  ) {
    return this.confirmOrder.execute(auth.shopId, id, auth.userId, dto);
  }

  @Post(':id/prepare')
  @RequirePermissions(Permission.SALES_ORDERS_WRITE)
  async prepare(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalesOrderVersionDto,
  ) {
    return this.prepareOrder.execute(auth.shopId, id, auth.userId, dto);
  }

  @Post(':id/deliver')
  @RequirePermissions(Permission.SALES_ORDERS_DELIVER)
  async deliver(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeliverSalesOrderDto,
  ) {
    return this.deliverOrder.execute(auth.shopId, id, auth.userId, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.SALES_ORDERS_WRITE)
  async cancel(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelSalesOrderDto,
  ) {
    return this.cancelOrder.execute(auth.shopId, id, auth.userId, dto);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.SALES_ORDERS_WRITE)
  async close(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalesOrderVersionDto,
  ) {
    return this.closeOrder.execute(auth.shopId, id, auth.userId, dto);
  }
}
