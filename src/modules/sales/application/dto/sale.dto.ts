import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { PaymentMethod } from '../../domain/entities/sale.entity';

export class SalePaymentDto {
  @ApiProperty({ enum: ['cash', 'mtn_momo', 'moov_money', 'credit', 'mixed'] })
  @IsEnum(['cash', 'mtn_momo', 'moov_money', 'credit', 'mixed'])
  method: PaymentMethod;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  amountCash?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  amountMomo?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  amountCredit?: number;
}

export class SaleLineDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 15000, description: 'Prix unitaire (défaut = prix catalogue)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lineDiscountAmount?: number;
}

export class CreateStandardSaleDto {
  @ApiProperty({ type: [SaleLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  items: SaleLineDto[];

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number;

  @ApiProperty({ type: SalePaymentDto })
  @ValidateNested()
  @Type(() => SalePaymentDto)
  payment: SalePaymentDto;

  @ApiPropertyOptional({ example: 'Vente comptoir' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateQuickSaleDto {
  @ApiProperty({ example: 25000 })
  @IsInt()
  @Min(1)
  totalAmount: number;

  @ApiProperty({ type: SalePaymentDto })
  @ValidateNested()
  @Type(() => SalePaymentDto)
  payment: SalePaymentDto;

  @ApiPropertyOptional({ example: 'Vente rapide comptoir' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelSaleDto {
  @ApiProperty({ example: 'Erreur de saisie sur la quantité' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason: string;
}

export class ListSalesQueryDto {
  @ApiPropertyOptional({ enum: ['completed', 'cancelled', 'partial', 'pending'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['standard', 'quick'] })
  @IsOptional()
  @IsString()
  saleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number;

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

export class SaleItemResponseDto {
  @ApiProperty()
  id: number;

  @ApiPropertyOptional()
  productId: number | null;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  lineTotal: number;
}

export class SaleResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'REC-20250626-0001' })
  receiptNumber: string;

  @ApiProperty({ enum: ['standard', 'quick'] })
  saleType: string;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  amountPaid: number;

  @ApiProperty()
  amountCash: number;

  @ApiProperty()
  amountMomo: number;

  @ApiProperty()
  amountCredit: number;

  @ApiProperty()
  paymentMethod: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  customerId: number | null;

  @ApiProperty()
  userId: number;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty()
  createdAt: number;

  @ApiPropertyOptional({ type: [SaleItemResponseDto] })
  items?: SaleItemResponseDto[];
}

export class SaleListItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  receiptNumber: string;

  @ApiProperty()
  saleType: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: number;
}
