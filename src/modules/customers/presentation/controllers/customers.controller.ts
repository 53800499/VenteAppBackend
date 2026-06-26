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
  ApiNotFoundResponse,
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
  ArchiveCustomerResponseDto,
  CreateCustomerDto,
  CustomerResponseDto,
  DebtReminderResponseDto,
  DebtorsListResponseDto,
  ListCustomersQueryDto,
  UpdateCustomerDto,
} from '../../application/dto/customer.dto';
import {
  ArchiveCustomerUseCase,
  CreateCustomerUseCase,
  GetCustomerUseCase,
  GetDebtReminderUseCase,
  ListCustomerSalesUseCase,
  ListCustomersUseCase,
  ListDebtorsUseCase,
  UpdateCustomerUseCase,
} from '../../application/use-cases/customer.use-cases';

@ApiTags('Clients')
@Controller('customers')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class CustomersController {
  constructor(
    private readonly listCustomers: ListCustomersUseCase,
    private readonly listDebtors: ListDebtorsUseCase,
    private readonly getCustomer: GetCustomerUseCase,
    private readonly listCustomerSales: ListCustomerSalesUseCase,
    private readonly createCustomer: CreateCustomerUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
    private readonly archiveCustomer: ArchiveCustomerUseCase,
    private readonly getDebtReminder: GetDebtReminderUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMERS_READ)
  @ApiOperation({
    summary: 'Lister les clients (ECR-08)',
    description: '**Permission** : `customers:read` — Tri : `name` | `debt` | `lastActivity` (RG-CLI-07).',
  })
  @ApiOkResponse({ type: [CustomerResponseDto] })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListCustomersQueryDto) {
    return this.listCustomers.execute(auth, query);
  }

  @Get('debtors')
  @RequirePermissions(Permission.CUSTOMERS_READ, Permission.DEBTS_READ)
  @ApiOperation({
    summary: 'Tableau des débiteurs (UC-11)',
    description: 'Clients avec solde dû, triés par montant décroissant.',
  })
  @ApiOkResponse({ type: DebtorsListResponseDto })
  debtors(@CurrentAuth() auth: AuthContext) {
    return this.listDebtors.execute(auth);
  }

  @Get(':id')
  @RequirePermissions(Permission.CUSTOMERS_READ)
  @ApiOperation({ summary: 'Fiche client avec historique récent' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiNotFoundResponse({ description: 'Client introuvable' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getCustomer.execute(auth, id);
  }

  @Get(':id/sales')
  @RequirePermissions(Permission.CUSTOMERS_READ, Permission.SALES_READ)
  @ApiOperation({ summary: 'Historique d\'achats du client' })
  @ApiParam({ name: 'id', example: 1 })
  getSales(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.listCustomerSales.execute(auth, id);
  }

  @Get(':id/debt-reminder')
  @RequirePermissions(Permission.CUSTOMERS_READ)
  @ApiOperation({
    summary: 'Message de rappel de dette WhatsApp (UC-10)',
    description: 'Retourne le message pré-rempli et l\'URL wa.me (RG-CLI-06).',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: DebtReminderResponseDto })
  debtReminder(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getDebtReminder.execute(auth, id);
  }

  @Post()
  @RequirePermissions(Permission.CUSTOMERS_WRITE)
  @ApiOperation({
    summary: 'Créer un client',
    description: '**Permission** : `customers:write` — Nom obligatoire ≥ 2 car. (RG-CLI-01).',
  })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateCustomerDto) {
    return this.createCustomer.execute(auth, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CUSTOMERS_WRITE)
  @ApiOperation({ summary: 'Modifier un client' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: CustomerResponseDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.updateCustomer.execute(auth, id, dto);
  }

  @Patch(':id/archive')
  @RequirePermissions(Permission.CUSTOMERS_ARCHIVE)
  @ApiOperation({
    summary: 'Archiver un client',
    description: 'Bloqué si dettes ouvertes (RG-CLI-03). Historique conservé (RG-CLI-04).',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: ArchiveCustomerResponseDto })
  archive(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.archiveCustomer.execute(auth, id);
  }
}
