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
  @IsInt()
  @Min(1)
  productId!: number;

  @IsInt()
  @Min(1)
  quantityOrdered!: number;

  @IsInt()
  @Min(0)
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

  @IsInt()
  customerId!: number;

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
  discount?: number;

  @IsOptional()
  @IsInt()
  tax?: number;

  @IsOptional()
  @IsInt()
  total?: number;

  @IsOptional()
  @IsInt()
  version?: number;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderItemDto)
  items!: CreateSalesOrderItemDto[];
}

/** Corps optionnel pour confirm / prepare / cancel / close (optimistic lock). */
export class SalesOrderVersionDto {
  @IsOptional()
  @IsInt()
  version?: number;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class DeliverSalesOrderItemDto {
  @IsInt()
  salesOrderItemId!: number;

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
  @IsInt()
  @Min(0)
  quantityReplaced?: number;

  @IsOptional()
  @IsString()
  refusalReason?: string;

  @IsOptional()
  @IsString()
  refusalDestination?: string;

  @IsOptional()
  @IsInt()
  replacementProductId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  replacementUnitPrice?: number;

  @IsInt()
  productId!: number;

  @IsInt()
  @Min(0)
  unitPrice!: number;
}

export class DeliverSalesOrderDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  @IsOptional()
  @IsString()
  remainingReason?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsInt()
  saleId?: number;

  @IsOptional()
  @IsInt()
  version?: number;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliverSalesOrderItemDto)
  items!: DeliverSalesOrderItemDto[];
}

export class CancelSalesOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsInt()
  version?: number;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
