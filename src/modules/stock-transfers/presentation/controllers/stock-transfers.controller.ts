import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
  CreateStockTransferDto,
  ReceiveStockTransferDto,
  ShipStockTransferDto,
} from '../../application/dto/stock-transfer.dto';
import {
  CancelTransferUseCase,
  CreateReturnTransferUseCase,
  CreateTransferUseCase,
  GetTransferDetailsUseCase,
  ListIncomingTransfersUseCase,
  ListOutgoingTransfersUseCase,
  NextTransferReferenceUseCase,
  ReceiveTransferUseCase,
  ShipTransferUseCase,
  ValidateTransferUseCase,
} from '../../application/use-cases/stock-transfer.use-cases';

@ApiTags('Transferts inter-boutiques')
@Controller('stock-transfers')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class StockTransfersController {
  constructor(
    private readonly listOutgoing: ListOutgoingTransfersUseCase,
    private readonly listIncoming: ListIncomingTransfersUseCase,
    private readonly getTransfer: GetTransferDetailsUseCase,
    private readonly createTransfer: CreateTransferUseCase,
    private readonly createReturnTransfer: CreateReturnTransferUseCase,
    private readonly validateTransfer: ValidateTransferUseCase,
    private readonly shipTransfer: ShipTransferUseCase,
    private readonly receiveTransfer: ReceiveTransferUseCase,
    private readonly cancelTransfer: CancelTransferUseCase,
    private readonly nextReference: NextTransferReferenceUseCase,
  ) {}

  @Get('outgoing')
  @RequirePermissions(Permission.INVENTORY_TRANSFER_READ)
  @ApiOperation({ summary: 'Lister les transferts sortants' })
  getOutgoing(@CurrentAuth() auth: AuthContext) {
    return this.listOutgoing.execute(auth);
  }

  @Get('incoming')
  @RequirePermissions(Permission.INVENTORY_TRANSFER_READ)
  @ApiOperation({ summary: 'Lister les transferts entrants' })
  getIncoming(@CurrentAuth() auth: AuthContext) {
    return this.listIncoming.execute(auth);
  }

  @Get('next-reference')
  @RequirePermissions(Permission.INVENTORY_TRANSFER_CREATE)
  @ApiOperation({ summary: 'Prochaine référence transfert' })
  getNextReference(@CurrentAuth() auth: AuthContext) {
    return this.nextReference.execute(auth);
  }

  @Get(':id')
  @RequirePermissions(Permission.INVENTORY_TRANSFER_READ)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Détail d\'un transfert' })
  getById(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getTransfer.execute(auth, id);
  }

  @Post()
  @RequirePermissions(Permission.INVENTORY_TRANSFER_CREATE)
  @ApiOperation({ summary: 'Créer un transfert (brouillon)' })
  @ApiCreatedResponse({ description: 'Transfert créé' })
  postCreate(@CurrentAuth() auth: AuthContext, @Body() dto: CreateStockTransferDto) {
    return this.createTransfer.execute(auth, dto);
  }

  @Post(':id/return')
  @RequirePermissions(Permission.INVENTORY_TRANSFER_CREATE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Créer un transfert retour depuis un transfert reçu' })
  postReturn(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.createReturnTransfer.execute(auth, id);
  }

  @Post(':id/validate')
  @RequirePermissions(Permission.INVENTORY_TRANSFER_CREATE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Valider un transfert (réservation FIFO)' })
  postValidate(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.validateTransfer.execute(auth, id);
  }

  @Post(':id/ship')
  @RequirePermissions(Permission.INVENTORY_TRANSFER_CREATE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Expédier (partiel ou total)' })
  postShip(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ShipStockTransferDto,
  ) {
    return this.shipTransfer.execute(auth, id, dto);
  }

  @Post(':id/receive')
  @RequirePermissions(Permission.INVENTORY_TRANSFER_RECEIVE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Réceptionner un transfert entrant' })
  postReceive(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveStockTransferDto,
  ) {
    return this.receiveTransfer.execute(auth, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.INVENTORY_TRANSFER_CREATE)
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'Transfert annulé' })
  @ApiOperation({ summary: 'Annuler un brouillon' })
  postCancel(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.cancelTransfer.execute(auth, id);
  }
}
