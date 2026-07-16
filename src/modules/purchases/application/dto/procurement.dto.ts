import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Etablissement Alafia' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '+22997000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'alafia@gmail.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Cotonou, Bénin' })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: 'Etablissement Alafia' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: '+22997000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'alafia@gmail.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Cotonou, Bénin' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isActive?: boolean;
}

export class CreatePurchaseOrderItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  quantityOrdered: number;

  @ApiProperty({ example: 5000 })
  @IsInt()
  @Min(0)
  unitCost: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  tax?: number;

  @ApiProperty({ example: 500000 })
  @IsInt()
  @Min(0)
  subtotal: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  supplierId: number;

  @ApiProperty({ example: 'CMD-2026-0001' })
  @IsString()
  @MinLength(3)
  number: string;

  @ApiProperty({ example: 1779836400000 })
  @IsInt()
  orderedAt: number;

  @ApiPropertyOptional({ example: 1780000000000 })
  @IsOptional()
  @IsInt()
  expectedAt?: number;

  @ApiProperty({ example: 500000 })
  @IsInt()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  tax?: number;

  @ApiProperty({ example: 500000 })
  @IsInt()
  @Min(0)
  total: number;

  @ApiPropertyOptional({ example: 'Commande urgente ciment' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;

  @ApiPropertyOptional({ example: 'CMD-2026-0001' })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ example: 1779836400000 })
  @IsOptional()
  @IsInt()
  orderedAt?: number;

  @ApiPropertyOptional({ example: 1780000000000 })
  @IsOptional()
  @IsInt()
  expectedAt?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  total?: number;

  @ApiPropertyOptional({ example: 'Modifié' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [CreatePurchaseOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items?: CreatePurchaseOrderItemDto[];
}

export class CreateReceiptItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  purchaseOrderItemId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  quantityReceived: number;

  @ApiProperty({ example: 5000 })
  @IsInt()
  @Min(0)
  unitCost: number;

  @ApiPropertyOptional({ example: 'LOT-CIM-2026' })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional({ example: 1811362800000 })
  @IsOptional()
  @IsInt()
  expiryDate?: number;
}

export class CreateReceiptDto {
  @ApiProperty({ example: 'BL-2026-0001' })
  @IsString()
  @MinLength(2)
  receiptNumber: string;

  @ApiProperty({ example: 1779836400000 })
  @IsInt()
  receivedAt: number;

  @ApiPropertyOptional({ example: 'Livraison conforme' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateReceiptItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptItemDto)
  items: CreateReceiptItemDto[];
}

export class CreateDirectReceiptItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  quantityReceived: number;

  @ApiProperty({ example: 5000 })
  @IsInt()
  @Min(0)
  unitCost: number;

  @ApiPropertyOptional({ example: 'LOT-CIM-2026' })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional({ example: 1811362800000 })
  @IsOptional()
  @IsInt()
  expiryDate?: number;
}

export class CreateDirectGoodsReceiptDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  supplierId: number;

  @ApiProperty({ example: 'GR-00001' })
  @IsString()
  @MinLength(2)
  receiptNumber: string;

  @ApiProperty({ example: 1779836400000 })
  @IsInt()
  receivedAt: number;

  @ApiPropertyOptional({ example: 'Livraison directe' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateDirectReceiptItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDirectReceiptItemDto)
  items: CreateDirectReceiptItemDto[];
}

export class CreateInvoiceDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  purchaseOrderId?: number;

  @ApiProperty({ example: 'FACT-2026-0001' })
  @IsString()
  @MinLength(2)
  invoiceNumber: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  supplierId: number;

  @ApiProperty({ example: 1779836400000 })
  @IsInt()
  invoiceDate: number;

  @ApiPropertyOptional({ example: 1780000000000 })
  @IsOptional()
  @IsInt()
  dueDate?: number;

  @ApiProperty({ example: 490000 })
  @IsInt()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  tax?: number;

  @ApiProperty({ example: 500000 })
  @IsInt()
  @Min(0)
  total: number;
}

export class CreatePaymentDto {
  @ApiProperty({ example: 250000 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ enum: ['cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check'] })
  @IsEnum(['cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check'])
  paymentMethod: 'cash' | 'mtn_momo' | 'moov_money' | 'card' | 'transfer' | 'check';

  @ApiProperty({ example: 1779836400000 })
  @IsInt()
  paymentDate: number;

  @ApiPropertyOptional({ example: 'TXN123456' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class ListPurchaseOrdersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({ enum: ['draft', 'validated', 'sent', 'partially_received', 'received', 'cancelled'] })
  @IsOptional()
  @IsEnum(['draft', 'validated', 'sent', 'partially_received', 'received', 'cancelled'])
  status?: 'draft' | 'validated' | 'sent' | 'partially_received' | 'received' | 'cancelled';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  from?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  to?: number;
}
