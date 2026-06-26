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
  ApiForbiddenResponse,
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
  DebtResponseDto,
  ForgiveDebtDto,
  ForgiveDebtResponseDto,
  ListDebtsQueryDto,
  RecordDebtPaymentDto,
  RecordDebtPaymentResponseDto,
} from '../../application/dto/debt.dto';
import {
  ForgiveDebtUseCase,
  GetDebtUseCase,
  ListDebtsUseCase,
  RecordDebtPaymentUseCase,
} from '../../application/use-cases/debt.use-cases';

@ApiTags('Dettes')
@Controller('debts')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class DebtsController {
  constructor(
    private readonly listDebts: ListDebtsUseCase,
    private readonly getDebt: GetDebtUseCase,
    private readonly recordPayment: RecordDebtPaymentUseCase,
    private readonly forgiveDebt: ForgiveDebtUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.DEBTS_READ)
  @ApiOperation({
    summary: 'Lister les dettes de la boutique',
    description: [
      '**Permission** : `debts:read`',
      '',
      'Tri par ancienneté croissante (RG-DET-09).',
      'Filtre `criticalOnly=true` : dettes ouvertes > 30 jours sans remboursement (RG-DET-10).',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [DebtResponseDto] })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListDebtsQueryDto) {
    return this.listDebts.execute(auth, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.DEBTS_READ)
  @ApiOperation({ summary: 'Détail d\'une dette avec historique des remboursements' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: DebtResponseDto })
  @ApiNotFoundResponse({ description: 'Dette introuvable' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getDebt.execute(auth, id);
  }

  @Post(':id/payments')
  @RequirePermissions(Permission.DEBTS_PAYMENT, Permission.PAYMENTS_CREATE)
  @ApiOperation({
    summary: 'Enregistrer un remboursement sur une dette (UC-08)',
    description: [
      '**Permissions** : `debts:payment` + `payments:create`',
      '',
      'RG-PAY-01 à 08, RG-DET-04 à 05 : acompte partiel ou total, reçu PAY-YYYYMMDD-NNNN.',
      'Mobile Money : référence/téléphone obligatoire (RG-PAY-02).',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiCreatedResponse({ type: RecordDebtPaymentResponseDto })
  @ApiNotFoundResponse({ description: 'Dette introuvable ou déjà soldée' })
  recordDebtPayment(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordDebtPaymentDto,
  ) {
    return this.recordPayment.execute(auth, id, dto);
  }

  @Patch(':id/forgive')
  @RequirePermissions(Permission.DEBTS_FORGIVE)
  @ApiOperation({
    summary: 'Pardonner une dette (patron)',
    description: [
      '**Permission** : `debts:forgive` — **Patron uniquement** (RG-DET-06)',
      '',
      'Action irréversible. Motif obligatoire ≥ 10 caractères (RG-DET-12).',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: ForgiveDebtResponseDto })
  @ApiForbiddenResponse({ description: 'Patron requis ou dette non pardonnable' })
  forgive(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ForgiveDebtDto,
  ) {
    return this.forgiveDebt.execute(auth, id, dto.reason);
  }
}
