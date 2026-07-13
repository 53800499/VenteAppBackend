import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { Permission } from '../../../../shared/enums/permission.enum';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantGuard } from '../../../tenants/tenant.guard';
import {
  CreateInvoiceDto,
  CreatePaymentDto,
  CreatePurchaseOrderDto,
  CreateReceiptDto,
  CreateSupplierDto,
  ListPurchaseOrdersQueryDto,
  UpdatePurchaseOrderDto,
  UpdateSupplierDto,
} from '../../application/dto/procurement.dto';
import {
  CancelPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  CreateSupplierUseCase,
  GetPurchaseOrderDetailsUseCase,
  ListPurchaseOrdersUseCase,
  ListSuppliersUseCase,
  ReceiveItemsUseCase,
  SendPurchaseOrderUseCase,
  UpdatePurchaseOrderUseCase,
  UpdateSupplierUseCase,
  ValidatePurchaseOrderUseCase,
  CreateSupplierInvoiceUseCase,
  RecordSupplierPaymentUseCase,
  ListInvoicesUseCase,
  GetInvoiceDetailsUseCase,
} from '../../application/use-cases/purchases.use-cases';

@ApiTags('Approvisionnements')
@Controller('purchases')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class PurchasesController {
  constructor(
    private readonly listSuppliers: ListSuppliersUseCase,
    private readonly createSupplier: CreateSupplierUseCase,
    private readonly updateSupplier: UpdateSupplierUseCase,
    private readonly listOrders: ListPurchaseOrdersUseCase,
    private readonly getOrder: GetPurchaseOrderDetailsUseCase,
    private readonly createOrder: CreatePurchaseOrderUseCase,
    private readonly updateOrder: UpdatePurchaseOrderUseCase,
    private readonly validateOrder: ValidatePurchaseOrderUseCase,
    private readonly sendOrder: SendPurchaseOrderUseCase,
    private readonly cancelOrder: CancelPurchaseOrderUseCase,
    private readonly receiveOrder: ReceiveItemsUseCase,
    private readonly listInvoices: ListInvoicesUseCase,
    private readonly getInvoice: GetInvoiceDetailsUseCase,
    private readonly createInvoice: CreateSupplierInvoiceUseCase,
    private readonly recordPayment: RecordSupplierPaymentUseCase,
  ) {}

  // Suppliers
  @Get('suppliers')
  @RequirePermissions(Permission.PROCUREMENT_READ)
  @ApiOperation({ summary: 'Lister les fournisseurs' })
  getSuppliers(@CurrentAuth() auth: AuthContext) {
    return this.listSuppliers.execute(auth);
  }

  @Post('suppliers')
  @RequirePermissions(Permission.PROCUREMENT_CREATE)
  @ApiOperation({ summary: 'Créer un fournisseur' })
  @ApiCreatedResponse({ description: 'Fournisseur créé' })
  postSupplier(@CurrentAuth() auth: AuthContext, @Body() dto: CreateSupplierDto) {
    return this.createSupplier.execute(auth, dto);
  }

  @Patch('suppliers/:id')
  @RequirePermissions(Permission.PROCUREMENT_UPDATE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Modifier un fournisseur' })
  patchSupplier(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.updateSupplier.execute(auth, id, dto);
  }

  // Purchase Orders
  @Get('orders')
  @RequirePermissions(Permission.PROCUREMENT_READ)
  @ApiOperation({ summary: 'Lister les commandes fournisseur' })
  getOrders(@CurrentAuth() auth: AuthContext, @Query() query: ListPurchaseOrdersQueryDto) {
    return this.listOrders.execute(auth, query);
  }

  @Post('orders')
  @RequirePermissions(Permission.PROCUREMENT_CREATE)
  @ApiOperation({ summary: 'Créer une commande d\'approvisionnement (brouillon)' })
  @ApiCreatedResponse({ description: 'Commande créée en brouillon' })
  postOrder(@CurrentAuth() auth: AuthContext, @Body() dto: CreatePurchaseOrderDto) {
    return this.createOrder.execute(auth, dto);
  }

  @Get('orders/:id')
  @RequirePermissions(Permission.PROCUREMENT_READ)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Détails d\'une commande fournisseur' })
  getOrderDetails(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getOrder.execute(auth, id);
  }

  @Patch('orders/:id')
  @RequirePermissions(Permission.PROCUREMENT_UPDATE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Modifier une commande d\'approvisionnement (brouillon)' })
  patchOrder(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.updateOrder.execute(auth, id, dto);
  }

  @Post('orders/:id/validate')
  @RequirePermissions(Permission.PROCUREMENT_UPDATE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Valider une commande d\'approvisionnement' })
  postValidateOrder(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.validateOrder.execute(auth, id);
  }

  @Post('orders/:id/send')
  @RequirePermissions(Permission.PROCUREMENT_UPDATE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Marquer la commande d\'approvisionnement comme envoyée' })
  postSendOrder(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.sendOrder.execute(auth, id);
  }

  @Post('orders/:id/cancel')
  @RequirePermissions(Permission.PROCUREMENT_CANCEL)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Annuler une commande d\'approvisionnement' })
  postCancelOrder(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    return this.cancelOrder.execute(auth, id, reason);
  }

  @Post('orders/:id/receive')
  @RequirePermissions(Permission.PROCUREMENT_RECEIVE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Enregistrer une réception de marchandises' })
  postReceiveOrder(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReceiptDto,
  ) {
    return this.receiveOrder.execute(auth, id, dto);
  }

  // Invoices & Payments
  @Get('invoices')
  @RequirePermissions(Permission.PROCUREMENT_READ)
  @ApiOperation({ summary: 'Lister les factures fournisseur' })
  getInvoices(@CurrentAuth() auth: AuthContext, @Query('supplierId') supplierId?: number) {
    return this.listInvoices.execute(auth, supplierId);
  }

  @Post('invoices')
  @RequirePermissions(Permission.PROCUREMENT_INVOICE_PAY)
  @ApiOperation({ summary: 'Créer une facture fournisseur' })
  postInvoice(@CurrentAuth() auth: AuthContext, @Body() dto: CreateInvoiceDto) {
    return this.createInvoice.execute(auth, dto);
  }

  @Get('invoices/:id')
  @RequirePermissions(Permission.PROCUREMENT_READ)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Détails d\'une facture fournisseur' })
  getInvoiceDetails(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getInvoice.execute(auth, id);
  }

  @Post('invoices/:id/payments')
  @RequirePermissions(Permission.PROCUREMENT_INVOICE_PAY)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Enregistrer un paiement de facture' })
  postPayment(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.recordPayment.execute(auth, id, dto);
  }
}
