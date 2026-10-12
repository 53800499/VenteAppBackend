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
  ApproveCashSessionDto,
  CloseCashSessionDto,
  CreateCashMovementDto,
  ListCashMovementsQueryDto,
  ListCashSessionsQueryDto,
  OpenCashSessionDto,
  OwnerDropCashDto,
  ReopenCashSessionDto,
  SubmitCashSessionClosingDto,
} from '../../application/dto/cash-session.dto';
import {
  ApproveCashSessionUseCase,
  CloseCashSessionUseCase,
  CreateCashMovementUseCase,
  ListCashMovementsUseCase,
  ListCashSessionsUseCase,
  OpenCashSessionUseCase,
  RecordOwnerDropUseCase,
  ReopenCashSessionUseCase,
  SubmitCashSessionClosingUseCase,
} from '../../application/use-cases/cash-session.use-cases';

@ApiTags('Gestion de caisse')
@Controller()
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class CashSessionsController {
  constructor(
    private readonly listSessions: ListCashSessionsUseCase,
    private readonly listMovements: ListCashMovementsUseCase,
    private readonly openSession: OpenCashSessionUseCase,
    private readonly createMovement: CreateCashMovementUseCase,
    private readonly recordOwnerDrop: RecordOwnerDropUseCase,
    private readonly submitClosingUseCase: SubmitCashSessionClosingUseCase,
    private readonly approveClosingUseCase: ApproveCashSessionUseCase,
    private readonly reopenSessionUseCase: ReopenCashSessionUseCase,
    private readonly closeSession: CloseCashSessionUseCase,
  ) {}

  @Get('cash-sessions')
  @RequirePermissions(Permission.CASH_SESSIONS_READ)
  @ApiOperation({ summary: 'Lister les sessions de caisse' })
  @ApiOkResponse({ description: 'Sessions de caisse' })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListCashSessionsQueryDto) {
    return this.listSessions.execute(auth, query);
  }

  @Post('cash-sessions/open')
  @RequirePermissions(Permission.CASH_SESSIONS_OPEN)
  @ApiOperation({ summary: 'Ouvrir une session de caisse' })
  @ApiCreatedResponse({ description: 'Session ouverte' })
  open(@CurrentAuth() auth: AuthContext, @Body() dto: OpenCashSessionDto) {
    return this.openSession.execute(auth, dto);
  }

  @Post('cash-sessions/:id/submit-closing')
  @RequirePermissions(Permission.CASH_SESSIONS_CLOSE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Soumettre la clôture de caisse (par l’employé avec justification des écarts)' })
  @ApiOkResponse({ description: 'Clôture soumise avec statut submitted, review_required ou justified' })
  submitClosing(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitCashSessionClosingDto,
  ) {
    return this.submitClosingUseCase.execute(auth, id, dto);
  }

  @Post('cash-sessions/:id/approve')
  @RequirePermissions(Permission.CASH_SESSIONS_APPROVE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Approuver une clôture de caisse (par le propriétaire ou responsable)' })
  @ApiOkResponse({ description: 'Session approuvée' })
  approve(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveCashSessionDto,
  ) {
    return this.approveClosingUseCase.execute(auth, id, dto);
  }

  @Post('cash-sessions/:id/reopen')
  @RequirePermissions(Permission.CASH_SESSIONS_APPROVE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Rouvrir exceptionnellement une session de caisse avec motif' })
  @ApiOkResponse({ description: 'Session rouverte' })
  reopen(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenCashSessionDto,
  ) {
    return this.reopenSessionUseCase.execute(auth, id, dto);
  }

  @Post('cash-sessions/:id/owner-drop')
  @RequirePermissions(Permission.CASH_SESSIONS_ADJUST)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Enregistrer une remise de fonds au propriétaire (cash drop)' })
  @ApiCreatedResponse({ description: 'Remise de fonds enregistrée' })
  ownerDrop(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OwnerDropCashDto,
  ) {
    return this.recordOwnerDrop.execute(auth, id, dto);
  }

  @Post('cash-sessions/:id/close')
  @RequirePermissions(Permission.CASH_SESSIONS_CLOSE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Clôturer directement une session de caisse (avec validation patron immédiate)' })
  @ApiOkResponse({ description: 'Session clôturée' })
  close(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.closeSession.execute(auth, id, dto);
  }

  @Post('cash-sessions/:id/movements')
  @RequirePermissions(Permission.CASH_SESSIONS_ADJUST)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Enregistrer un mouvement de caisse standard (apport ou retrait)' })
  @ApiCreatedResponse({ description: 'Mouvement créé' })
  movement(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.createMovement.execute(auth, id, dto);
  }

  @Get('cash-movements')
  @RequirePermissions(Permission.CASH_SESSIONS_READ)
  @ApiOperation({ summary: 'Lister les mouvements de caisse' })
  @ApiOkResponse({ description: 'Liste des mouvements de caisse' })
  movements(@CurrentAuth() auth: AuthContext, @Query() query: ListCashMovementsQueryDto) {
    return this.listMovements.execute(auth, query);
  }
}
