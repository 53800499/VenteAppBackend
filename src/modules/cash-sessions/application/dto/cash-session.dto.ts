import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListCashSessionsQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class OpenCashSessionDto {
  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  openingCash!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  openingMomo?: number;
}

export class CloseCashSessionDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedCash!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedMomo!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  closingNote?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salesCash!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salesMomo!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expensesCash!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expensesMomo!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  depositsCash!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  depositsMomo!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  withdrawalsCash!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  withdrawalsMomo!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  saleCount!: number;

  @ApiPropertyOptional({ description: 'PIN patron (obligatoire si vendeur)' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  ownerPin?: string;
}

export class CreateCashMovementDto {
  @ApiProperty({ enum: ['deposit', 'withdrawal'] })
  @IsString()
  movementType!: 'deposit' | 'withdrawal';

  @ApiProperty({ enum: ['cash', 'mtn_momo', 'moov_money'] })
  @IsString()
  registerType!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListCashMovementsQueryDto {
  @ApiPropertyOptional({ default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
