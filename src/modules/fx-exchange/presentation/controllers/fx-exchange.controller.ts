import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
  CloseFxSessionDto,
  CreateFxMovementDto,
  CreateFxOperationDto,
  CreateFxRateDto,
  ListFxOperationsQueryDto,
  ListFxRateHistoryQueryDto,
  OpenFxSessionDto,
  PreviewFxOperationDto,
  ToggleFxModuleDto,
  UpsertShopCurrenciesDto,
} from '../../application/dto/fx-exchange.dto';
import {
  CloseFxSessionUseCase,
  ConfirmFxSessionCloseUseCase,
  CancelFxPendingCloseUseCase,
  CreateFxMovementUseCase,
  CreateFxOperationUseCase,
  CreateFxRateUseCase,
  GetFxDailyReportUseCase,
  GetFxModuleStatusUseCase,
  GetOpenFxSessionUseCase,
  ListFxCurrenciesUseCase,
  ListFxMovementsUseCase,
  ListFxOperationsUseCase,
  ListFxRateHistoryUseCase,
  ListFxRatesUseCase,
  ListFxSessionsUseCase,
  OpenFxSessionUseCase,
  PreviewFxOperationUseCase,
  ToggleFxModuleUseCase,
  UpsertFxShopCurrenciesUseCase,
} from '../../application/use-cases/fx-exchange.use-cases';

@ApiTags('Bureau de change')
@Controller()
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class FxExchangeController {
  constructor(
    private readonly getStatus: GetFxModuleStatusUseCase,
    private readonly toggleModule: ToggleFxModuleUseCase,
    private readonly listCurrencies: ListFxCurrenciesUseCase,
    private readonly upsertCurrencies: UpsertFxShopCurrenciesUseCase,
    private readonly createRate: CreateFxRateUseCase,
    private readonly listRates: ListFxRatesUseCase,
    private readonly listRateHistory: ListFxRateHistoryUseCase,
    private readonly listSessions: ListFxSessionsUseCase,
    private readonly getOpenSession: GetOpenFxSessionUseCase,
    private readonly openSession: OpenFxSessionUseCase,
    private readonly closeSession: CloseFxSessionUseCase,
    private readonly confirmCloseSession: ConfirmFxSessionCloseUseCase,
    private readonly cancelPendingClose: CancelFxPendingCloseUseCase,
    private readonly createOperation: CreateFxOperationUseCase,
    private readonly previewOperation: PreviewFxOperationUseCase,
    private readonly listOperations: ListFxOperationsUseCase,
    private readonly createMovement: CreateFxMovementUseCase,
    private readonly listMovements: ListFxMovementsUseCase,
    private readonly dailyReport: GetFxDailyReportUseCase,
  ) {}

  @Get('fx-exchange/status')
  @RequirePermissions(Permission.FX_EXCHANGE_READ)
  @ApiOperation({ summary: 'Statut du module Bureau de change' })
  status(@CurrentAuth() auth: AuthContext) {
    return this.getStatus.execute(auth);
  }

  @Post('fx-exchange/toggle')
  @RequirePermissions(Permission.SETTINGS_WRITE)
  @ApiOperation({ summary: 'Activer / désactiver le module Bureau de change' })
  toggle(@CurrentAuth() auth: AuthContext, @Body() dto: ToggleFxModuleDto) {
    return this.toggleModule.execute(auth, dto.enabled);
  }

  @Get('fx-exchange/currencies')
  @RequirePermissions(Permission.FX_EXCHANGE_READ)
  @ApiOperation({ summary: 'Catalogue et devises actives de la boutique' })
  currencies(@CurrentAuth() auth: AuthContext) {
    return this.listCurrencies.execute(auth);
  }

  @Put('fx-exchange/currencies')
  @RequirePermissions(Permission.FX_EXCHANGE_CONFIGURE)
  @ApiOperation({ summary: 'Configurer les devises actives' })
  configureCurrencies(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UpsertShopCurrenciesDto,
  ) {
    return this.upsertCurrencies.execute(auth, dto);
  }

  @Get('fx-exchange/rates')
  @RequirePermissions(Permission.FX_EXCHANGE_READ)
  @ApiOperation({ summary: 'Taux du jour (derniers par devise)' })
  rates(@CurrentAuth() auth: AuthContext) {
    return this.listRates.execute(auth);
  }

  @Post('fx-exchange/rates')
  @RequirePermissions(Permission.FX_EXCHANGE_RATES)
  @ApiOperation({ summary: 'Enregistrer un taux du jour' })
  @ApiCreatedResponse({ description: 'Taux enregistré' })
  setRate(@CurrentAuth() auth: AuthContext, @Body() dto: CreateFxRateDto) {
    return this.createRate.execute(auth, dto);
  }

  @Get('fx-exchange/rates/history')
  @RequirePermissions(Permission.FX_EXCHANGE_READ)
  @ApiOperation({ summary: 'Historique des taux' })
  rateHistory(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListFxRateHistoryQueryDto,
  ) {
    return this.listRateHistory.execute(auth, query);
  }

  @Get('fx-exchange/sessions')
  @RequirePermissions(Permission.FX_EXCHANGE_READ)
  @ApiOperation({ summary: 'Lister les sessions FX' })
  sessions(@CurrentAuth() auth: AuthContext) {
    return this.listSessions.execute(auth);
  }

  @Get('fx-exchange/sessions/open')
  @RequirePermissions(Permission.FX_EXCHANGE_READ)
  @ApiOperation({ summary: 'Session FX ouverte + soldes live' })
  openSessionState(@CurrentAuth() auth: AuthContext) {
    return this.getOpenSession.execute(auth);
  }

  @Post('fx-exchange/sessions/open')
  @RequirePermissions(Permission.FX_EXCHANGE_SESSION_OPEN)
  @ApiOperation({ summary: 'Ouvrir une session FX' })
  @ApiCreatedResponse({ description: 'Session ouverte' })
  open(@CurrentAuth() auth: AuthContext, @Body() dto: OpenFxSessionDto) {
    return this.openSession.execute(auth, dto);
  }

  @Post('fx-exchange/sessions/:id/close')
  @RequirePermissions(Permission.FX_EXCHANGE_SESSION_CLOSE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Soumettre le comptage (pending_close)' })
  close(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseFxSessionDto,
  ) {
    return this.closeSession.execute(auth, id, dto);
  }

  @Post('fx-exchange/sessions/:id/confirm-close')
  @RequirePermissions(Permission.FX_EXCHANGE_SESSION_CLOSE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Valider définitivement la clôture FX' })
  confirmClose(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.confirmCloseSession.execute(auth, id);
  }

  @Post('fx-exchange/sessions/:id/cancel-close')
  @RequirePermissions(Permission.FX_EXCHANGE_SESSION_CLOSE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Annuler un comptage et rouvrir la session' })
  cancelClose(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cancelPendingClose.execute(auth, id);
  }

  @Post('fx-exchange/operations/preview')
  @RequirePermissions(Permission.FX_EXCHANGE_OPERATE)
  @ApiOperation({ summary: 'Prévisualiser une opération FX' })
  preview(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: PreviewFxOperationDto,
  ) {
    return this.previewOperation.execute(auth, dto);
  }

  @Post('fx-exchange/sessions/:id/operations')
  @RequirePermissions(Permission.FX_EXCHANGE_OPERATE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Enregistrer une opération FX' })
  @ApiCreatedResponse({ description: 'Opération enregistrée' })
  operation(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFxOperationDto,
  ) {
    return this.createOperation.execute(auth, id, dto);
  }

  @Get('fx-exchange/operations')
  @RequirePermissions(Permission.FX_EXCHANGE_READ)
  @ApiOperation({ summary: 'Historique des opérations FX' })
  operations(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListFxOperationsQueryDto,
  ) {
    return this.listOperations.execute(auth, query);
  }

  @Post('fx-exchange/sessions/:id/movements')
  @RequirePermissions(Permission.FX_EXCHANGE_OPERATE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Enregistrer un mouvement manuel FX' })
  @ApiCreatedResponse({ description: 'Mouvement enregistré' })
  movement(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFxMovementDto,
  ) {
    return this.createMovement.execute(auth, id, dto);
  }

  @Get('fx-exchange/movements')
  @RequirePermissions(Permission.FX_EXCHANGE_READ)
  @ApiOperation({ summary: 'Historique des mouvements FX' })
  movements(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListFxOperationsQueryDto,
  ) {
    return this.listMovements.execute(auth, query);
  }

  @Get('fx-exchange/reports/daily/:sessionId')
  @RequirePermissions(Permission.FX_EXCHANGE_REPORT)
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Rapport journalier FX' })
  report(
    @CurrentAuth() auth: AuthContext,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.dailyReport.execute(auth, sessionId);
  }
}
