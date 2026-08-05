import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../../shared/guards/admin.guard';
import type { AdminAuthContext } from '../../../../shared/guards/admin.guard';
import { CurrentAdmin } from '../../../../shared/decorators/current-admin.decorator';
import { RequireAdminRoles } from '../../../../shared/decorators/admin-roles.decorator';
import { AdminRole } from '../../../../shared/enums/admin-role.enum';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';

export class ManualVerifyPaymentDto {
  providerReference!: string;
  amountXof!: number;
  reason!: string;
}

@ApiTags('Admin - Paiements')
@Controller('admin/payments')
@UseGuards(AdminGuard)
@ApiBearerAuth()
@UseInterceptors(TransformResponseInterceptor)
export class AdminPaymentsController {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'Supervision des paiements Mobile Money (FedaPay / KKiaPay)' })
  async listPayments(@Query('status') statusFilter?: string) {
    const db = this.tenantDb.getAdminClient();

    try {
      const { data: payments } = await db.from('payments').select('*');
      const { data: shops } = await db.from('shops').select('id, name');
      const shopMap = new Map((shops || []).map((s: any) => [s.id, s.name]));

      const transactions = (payments || []).map((p: any) => ({
        id: `tx-${p.id}`,
        tenantId: `tenant-${p.shop_id}`,
        tenantName: shopMap.get(p.shop_id) || `Entreprise #${p.shop_id}`,
        provider: (p.method || 'MOBILE_MONEY').toUpperCase(),
        providerRef: p.reference || p.receipt_number || `REF-${p.id}`,
        amount: Number(p.amount) || 0,
        currency: 'XOF',
        status: p.status === 'confirmed' ? 'SUCCESS' : (p.status === 'cancelled' ? 'FAILED' : 'PENDING'),
        paymentMethod: p.method === 'mtn_momo' ? 'MTN Mobile Money' : (p.method === 'moov_money' ? 'Moov Money' : 'Espèces / Mobile Money'),
        createdAt: typeof p.created_at === 'number'
          ? new Date(p.created_at).toISOString()
          : p.created_at || new Date().toISOString(),
        verifiedAt: p.status === 'confirmed' ? new Date().toISOString() : null,
      }));

      if (statusFilter) {
        return transactions.filter((t: any) => t.status === statusFilter);
      }
      return transactions;
    } catch {
      return [];
    }
  }

  @Post(':id/manual-verify')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_ADMIN)
  @ApiOperation({ summary: 'Validation manuelle exceptionnelle d\'une transaction Mobile Money' })
  manualVerify(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body() dto: ManualVerifyPaymentDto,
  ) {
    return {
      success: true,
      transactionId: id,
      status: 'SUCCESS',
      verifiedBy: admin.email,
      verifiedAt: new Date().toISOString(),
      providerReference: dto.providerReference,
      amountXof: dto.amountXof,
      reason: dto.reason,
    };
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Lister les factures d\'abonnements générées' })
  async listInvoices() {
    const db = this.tenantDb.getAdminClient();
    try {
      const { data: shops } = await db.from('shops').select('*');
      const { data: orgs } = await db.from('organizations').select('*');
      const orgMap = new Map((orgs || []).map((o: any) => [o.id, o.name]));

      if (shops && shops.length > 0) {
        return shops.map((s: any, idx: number) => ({
          id: `INV-2026-${String(idx + 1).padStart(3, '0')}`,
          date: s.created_at ? new Date(s.created_at).toISOString().slice(0, 10) : '2026-08-01',
          customer: orgMap.get(s.organization_id) || s.name || `Entreprise #${s.id}`,
          amount: s.plan === 'BUSINESS' ? '150 000 FCFA' : (s.plan === 'PRO' ? '50 000 FCFA' : '25 000 FCFA'),
          status: 'PAYÉE',
        }));
      }
    } catch {}

    return [];
  }

  @Get('refunds')
  @ApiOperation({ summary: 'Lister les demandes de remboursement' })
  async listRefunds() {
    return [];
  }
}

