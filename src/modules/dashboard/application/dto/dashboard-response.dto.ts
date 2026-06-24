import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardRecentSaleDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 15000, description: 'Montant total FCFA' })
  totalAmount: number;

  @ApiProperty({ example: 1704067200000 })
  createdAt: number;

  @ApiPropertyOptional({ example: 'Kofi Client' })
  customerName?: string | null;

  @ApiProperty({ example: 'cash', enum: ['cash', 'momo', 'mixed', 'credit'] })
  paymentMode: string;
}

export class DashboardFinancialDto {
  @ApiProperty({ example: 45000 })
  totalCash: number;

  @ApiProperty({ example: 12000 })
  totalMomo: number;

  @ApiProperty({ example: 8000 })
  totalCredit: number;

  @ApiPropertyOptional({ example: 5500, nullable: true })
  estimatedProfit: number | null;

  @ApiProperty({ example: true })
  profitAvailable: boolean;

  @ApiPropertyOptional({ example: 'Bénéfice indisponible : renseignez le prix d\'achat...' })
  profitWarning?: string | null;

  @ApiProperty({ example: 25000 })
  totalDebt: number;
}

export class DashboardKpisDto {
  @ApiProperty({ example: 65000, description: 'CA du jour (RG-DB-01)' })
  totalRevenue: number;

  @ApiProperty({ example: 12 })
  saleCount: number;

  @ApiProperty({ example: 3, description: 'Produits en alerte stock (RG-DB-03)' })
  lowStockCount: number;

  @ApiProperty({ example: 2, description: 'Clients débiteurs (RG-DB-04)' })
  debtorCount: number;
}

export class DashboardResponseDto {
  @ApiProperty({ example: 1 })
  shopId: number;

  @ApiProperty({ example: '2026-06-24' })
  date: string;

  @ApiProperty({ type: DashboardKpisDto })
  kpis: DashboardKpisDto;

  @ApiPropertyOptional({ type: DashboardFinancialDto, description: 'Requiert dashboard:financial' })
  financial?: DashboardFinancialDto;

  @ApiProperty({ type: [DashboardRecentSaleDto] })
  recentSales: DashboardRecentSaleDto[];

  @ApiProperty({ example: 1704067200000 })
  generatedAt: number;
}
