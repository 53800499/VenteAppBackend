import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class GetReportQueryDto {
  @ApiPropertyOptional({
    enum: ['today', 'week', 'month', 'custom'],
    default: 'month',
    description: 'Période prédéfinie (fuseau Bénin)',
  })
  @IsOptional()
  @IsEnum(['today', 'week', 'month', 'custom'])
  period?: 'today' | 'week' | 'month' | 'custom';

  @ApiPropertyOptional({ description: 'Epoch ms début (requis si period=custom)' })
  @IsOptional()
  @IsInt()
  from?: number;

  @ApiPropertyOptional({ description: 'Epoch ms fin (requis si period=custom)' })
  @IsOptional()
  @IsInt()
  to?: number;

  @ApiPropertyOptional({
    description: 'Vue consolidée multi-boutiques — V3, patron + shops:consolidated_read',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  consolidated?: boolean;

  @ApiPropertyOptional({ enum: ['quantity', 'revenue'], default: 'quantity' })
  @IsOptional()
  @IsEnum(['quantity', 'revenue'])
  topBy?: 'quantity' | 'revenue';

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  topLimit?: number;
}

export class ReportPeriodDto {
  @ApiProperty()
  preset: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  fromMs: number;

  @ApiProperty()
  toMs: number;
}

export class ReportSalesKpisDto {
  @ApiProperty({ description: 'CA brut — total ventes (encaissé + crédit)' })
  grossRevenue: number;

  @ApiProperty({ description: 'CA encaissé — hors crédit' })
  collectedRevenue: number;

  @ApiProperty()
  creditGranted: number;

  @ApiProperty()
  saleCount: number;

  @ApiProperty()
  averageBasket: number;

  @ApiProperty()
  totalCash: number;

  @ApiProperty()
  totalMomo: number;

  @ApiProperty()
  totalCredit: number;
}

export class ReportFinancialKpisDto {
  @ApiPropertyOptional()
  estimatedProfit: number | null;

  @ApiProperty()
  profitAvailable: boolean;

  @ApiPropertyOptional()
  profitWarning: string | null;

  @ApiPropertyOptional({ description: 'RG-STAT-03 — % remboursé / dettes créées sur la période' })
  recoveryRate: number | null;

  @ApiProperty()
  recoveryRateAvailable: boolean;

  @ApiProperty()
  debtsCreatedAmount: number;

  @ApiProperty()
  debtsRepaidAmount: number;
}

export class ReportTopProductDto {
  @ApiProperty()
  rank: number;

  @ApiPropertyOptional()
  productId: number | null;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  quantitySold: number;

  @ApiProperty()
  revenue: number;
}

export class ReportSellerPerformanceDto {
  @ApiProperty()
  userId: number;

  @ApiPropertyOptional()
  userName: string | null;

  @ApiProperty()
  saleCount: number;

  @ApiProperty()
  totalRevenue: number;
}

export class ReportResponseDto {
  @ApiPropertyOptional({ description: 'Boutique active (null si consolidé V3)' })
  shopId: number | null;

  @ApiProperty({ type: [Number] })
  shopIds: number[];

  @ApiProperty()
  consolidated: boolean;

  @ApiProperty({ type: ReportPeriodDto })
  period: ReportPeriodDto;

  @ApiProperty({ description: 'RG-STAT-05 — aucune vente sur la période' })
  empty: boolean;

  @ApiPropertyOptional()
  emptyMessage: string | null;

  @ApiProperty({ type: ReportSalesKpisDto })
  sales: ReportSalesKpisDto;

  @ApiPropertyOptional({ type: ReportFinancialKpisDto, description: 'Requiert reports:financial' })
  financial?: ReportFinancialKpisDto;

  @ApiProperty({ type: [ReportTopProductDto] })
  topProducts: ReportTopProductDto[];

  @ApiPropertyOptional({
    type: [ReportSellerPerformanceDto],
    description: 'V2 — performance par vendeur',
  })
  sellerPerformance?: ReportSellerPerformanceDto[];

  @ApiProperty()
  generatedAt: number;
}
