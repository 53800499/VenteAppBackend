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
  CloseCashSessionDto,
  CreateCashMovementDto,
  ListCashMovementsQueryDto,
  ListCashSessionsQueryDto,
  OpenCashSessionDto,
} from '../../application/dto/cash-session.dto';
import {
  CloseCashSessionUseCase,
  CreateCashMovementUseCase,
  ListCashMovementsUseCase,
  ListCashSessionsUseCase,
  OpenCashSessionUseCase,
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

  @Post('cash-sessions/:id/close')
  @RequirePermissions(Permission.CASH_SESSIONS_CLOSE)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Clôturer une session de caisse' })
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
  @ApiOperation({ summary: 'Enregistrer un mouvement de caisse' })
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
  movements(@CurrentAuth() auth: AuthContext, @Query() query: ListCashMovementsQueryDto) {
    return this.listMovements.execute(auth, query);
  }
}
