import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import { TenantGuard } from '../../../tenants/tenant.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';

@ApiTags('Relances (Back-Office)')
@Controller('reminders')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard)
@ApiBearerAuth()
export class RemindersController {
  @Get()
  @ApiOperation({ summary: 'Lister les relances' })
  listReminders(@Query() query: any) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };
  }

  @Get('invoices/:invoiceId')
  @ApiOperation({ summary: 'Relances pour une facture' })
  getInvoiceReminders(@Param('invoiceId') invoiceId: string) {
    return [];
  }

  @Get('clients/:clientId')
  @ApiOperation({ summary: 'Relances pour un client' })
  getClientReminders(@Param('clientId') clientId: string) {
    return [];
  }

  @Get('settings')
  @ApiOperation({ summary: 'Configuration des relances' })
  getReminderSettings() {
    return {
      enabled: true,
      autoSend: false,
      daysBeforeDue: 3,
      daysAfterDue: 7,
      emailTemplate: 'defaut',
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Mettre à jour la configuration des relances' })
  updateReminderSettings(@Body() body: any) {
    return {
      enabled: body.enabled ?? true,
      autoSend: body.autoSend ?? false,
      daysBeforeDue: body.daysBeforeDue ?? 3,
      daysAfterDue: body.daysAfterDue ?? 7,
      emailTemplate: body.emailTemplate || 'defaut',
    };
  }

  @Post('manual')
  @ApiOperation({ summary: 'Déclencher une relance manuelle' })
  manualReminder(@Body() body: any) {
    return { message: 'Relance envoyée avec succès.' };
  }

  @Post('process')
  @ApiOperation({ summary: 'Traiter le lot de relances' })
  processReminders() {
    return { processedCount: 0, successCount: 0, failureCount: 0 };
  }

  @Post('suggestions')
  @ApiOperation({ summary: 'Analyse comportement de paiement client' })
  suggestions(@Body() body: any) {
    return {
      avgDaysToPay: 5,
      onTimePaymentRate: 0.9,
      paidInvoicesAnalyzed: 10,
      suggestions: ['Client ponctuel — aucun ajustement requis.'],
    };
  }
}
