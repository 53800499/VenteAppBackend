import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
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
import { ListPaymentsQueryDto, PaymentResponseDto } from '../../application/dto/payment.dto';
import { GetPaymentUseCase, ListPaymentsUseCase } from '../../application/use-cases/payment.use-cases';

@ApiTags('Paiements')
@Controller('payments')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class PaymentsController {
  constructor(
    private readonly listPayments: ListPaymentsUseCase,
    private readonly getPayment: GetPaymentUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Lister les paiements de la boutique', description: '**Permission** : `payments:read`' })
  @ApiOkResponse({ type: [PaymentResponseDto] })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListPaymentsQueryDto) {
    return this.listPayments.execute(auth, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Détail d\'un paiement' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({ description: 'Paiement introuvable' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getPayment.execute(auth, id);
  }
}
