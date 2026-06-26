import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListPaymentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  saleId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  debtId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number;

  @ApiPropertyOptional({ enum: ['cash', 'mtn_momo', 'moov_money', 'other'] })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: 'Epoch ms début' })
  @IsOptional()
  @IsInt()
  from?: number;

  @ApiPropertyOptional({ description: 'Epoch ms fin' })
  @IsOptional()
  @IsInt()
  to?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class PaymentResponseDto {
  @ApiProperty()
  id: number;

  @ApiPropertyOptional()
  saleId: number | null;

  @ApiPropertyOptional()
  debtId: number | null;

  @ApiPropertyOptional()
  customerId: number | null;

  @ApiPropertyOptional({ example: 'PAY-20250626-0001' })
  receiptNumber: string | null;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional()
  reference: string | null;

  @ApiProperty()
  changeGiven: number;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty()
  createdAt: number;
}
