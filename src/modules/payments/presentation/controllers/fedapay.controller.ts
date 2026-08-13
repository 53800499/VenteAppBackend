import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TenantGuard } from '../../../tenants/tenant.guard';
import { FedaPayService } from '../../services/fedapay.service';

export class InitializeFedaPayDto {
  amount: number;
  description: string;
  phoneNumber?: string;
  mode?: string; // 'mtn', 'moov', 'celtiis', 'card'
  planCode?: string;
  durationDays?: number;
  addonCode?: string;
}

@ApiTags('FedaPay')
@Controller('payments/fedapay')
export class FedaPayController {
  constructor(private readonly fedapayService: FedaPayService) {}

  @Post('initialize')
  @UseGuards(SessionGuard, TenantGuard)
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Initialiser une transaction de paiement FedaPay' })
  async initialize(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: InitializeFedaPayDto,
  ) {
    return this.fedapayService.createTransaction({
      ...dto,
      shopId: auth.shopId,
    });
  }

  @Get('status/:id')
  @UseGuards(SessionGuard, TenantGuard)
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Vérifier l\'état d\'une transaction FedaPay' })
  async checkStatus(@Param('id', ParseIntPipe) id: number) {
    return this.fedapayService.checkStatus(id);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook de notification automatique FedaPay' })
  async webhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    return this.fedapayService.handleWebhook(body, headers);
  }
}
