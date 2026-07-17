import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateStockTransferItemDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  productId!: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  quantityRequested!: number;
}

export class CreateStockTransferDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  destinationShopId!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ['outbound', 'return'] })
  @IsOptional()
  @IsString()
  transferType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentTransferId?: number;

  @ApiProperty({ type: [CreateStockTransferItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferItemDto)
  items!: CreateStockTransferItemDto[];
}

export class ReceiveTransferProductSetupDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  priceSell!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productServerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priceBuy?: number;
}

export class ReceiveStockTransferItemDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  itemId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantityReceived!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ReceiveTransferProductSetupDto)
  productSetup?: ReceiveTransferProductSetupDto;
}

export class ReceiveStockTransferDto {
  @ApiProperty({ type: [ReceiveStockTransferItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveStockTransferItemDto)
  items!: ReceiveStockTransferItemDto[];
}

export class ShipStockTransferItemDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  itemId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ShipStockTransferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [ShipStockTransferItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShipStockTransferItemDto)
  items!: ShipStockTransferItemDto[];
}
