import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class GetSalesAnalysisQueryDto {
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
  @Type(() => Number)
  @IsInt()
  from?: number;

  @ApiPropertyOptional({ description: 'Epoch ms fin (requis si period=custom)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  to?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  marginTopLimit?: number;
}

export class SalesAnalysisPeriodDto {
  @ApiProperty()
  preset: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  fromMs: number;

  @ApiProperty()
  toMs: number;
}

export class CategorySalesSummaryDto {
  @ApiPropertyOptional()
  categoryId: number | null;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  productCount: number;

  @ApiProperty()
  quantitySold: number;

  @ApiProperty()
  revenue: number;
}

export class MarginProductLineDto {
  @ApiPropertyOptional()
  productId: number | null;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  quantitySold: number;

  @ApiProperty()
  revenue: number;

  @ApiProperty()
  estimatedCost: number;

  @ApiProperty()
  estimatedProfit: number;
}

export class MarginSummaryDto {
  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  totalCost: number;

  @ApiProperty()
  estimatedProfit: number;

  @ApiProperty()
  linesWithCost: number;

  @ApiProperty()
  totalLines: number;

  @ApiProperty({ type: [MarginProductLineDto] })
  topProducts: MarginProductLineDto[];
}

export class PriceDeviationLineDto {
  @ApiProperty()
  saleId: number;

  @ApiProperty()
  soldAt: number;

  @ApiPropertyOptional()
  productId: number | null;

  @ApiProperty()
  productName: string;

  @ApiPropertyOptional()
  catalogPrice: number | null;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  discountAmount: number;

  @ApiPropertyOptional()
  sellerName: string | null;
}

export class SalesTrendPointDto {
  @ApiProperty()
  bucketStartMs: number;

  @ApiProperty()
  label: string;

  @ApiProperty()
  revenue: number;

  @ApiProperty()
  saleCount: number;

  @ApiProperty()
  quantitySold: number;
}

export class SalesTrendSummaryDto {
  @ApiProperty({ type: [SalesTrendPointDto] })
  points: SalesTrendPointDto[];

  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  totalSaleCount: number;
}

export class SalesAnalysisResponseDto {
  @ApiProperty()
  shopId: number;

  @ApiProperty({ type: SalesAnalysisPeriodDto })
  period: SalesAnalysisPeriodDto;

  @ApiProperty()
  empty: boolean;

  @ApiPropertyOptional()
  emptyMessage: string | null;

  @ApiProperty({ type: [CategorySalesSummaryDto] })
  categories: CategorySalesSummaryDto[];

  @ApiPropertyOptional({ type: MarginSummaryDto })
  margins?: MarginSummaryDto;

  @ApiProperty({ type: [PriceDeviationLineDto] })
  priceDeviations: PriceDeviationLineDto[];

  @ApiProperty({ type: SalesTrendSummaryDto })
  trends: SalesTrendSummaryDto;

  @ApiProperty()
  generatedAt: number;
}
