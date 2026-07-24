import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateSalesOrderItemDto {
  @IsString()
  productLocalId!: string;

  @IsInt()
  @Min(1)
  quantityOrdered!: number;

  @IsInt()
  @Min(1)
  unitPrice!: number;

  @IsOptional()
  @IsInt()
  lineTotal?: number;
}

export class CreateSalesOrderDto {
  @IsOptional()
  @IsInt()
  localId?: number;

  @IsString()
  number!: string;

  @IsString()
  customerLocalId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  orderedAt?: number;

  @IsOptional()
  @IsInt()
  subtotal?: number;

  @IsOptional()
  @IsInt()
  total?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderItemDto)
  items!: CreateSalesOrderItemDto[];
}

export class DeliverSalesOrderItemDto {
  @IsString()
  salesOrderItemId!: string;

  @IsInt()
  @Min(0)
  quantitySent!: number;

  @IsInt()
  @Min(0)
  quantityAccepted!: number;

  @IsInt()
  @Min(0)
  quantityRefused!: number;

  @IsOptional()
  @IsString()
  refusalReason?: string;

  @IsString()
  productId!: string;

  @IsInt()
  @Min(0)
  unitPrice!: number;
}

export class DeliverSalesOrderDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliverSalesOrderItemDto)
  items!: DeliverSalesOrderItemDto[];
}

export class CancelSalesOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
