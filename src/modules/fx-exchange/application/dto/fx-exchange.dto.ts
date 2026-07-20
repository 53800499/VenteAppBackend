import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ToggleFxModuleDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpsertShopCurrencyItemDto {
  @ApiProperty({ example: 'NGN' })
  @IsString()
  currencyCode!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpsertShopCurrenciesDto {
  @ApiProperty({ type: [UpsertShopCurrencyItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertShopCurrencyItemDto)
  currencies!: UpsertShopCurrencyItemDto[];
}

export class CreateFxRateDto {
  @ApiProperty({ example: 'NGN' })
  @IsString()
  quoteCurrency!: string;

  @ApiProperty({ example: 380 })
  @IsInt()
  @Min(1)
  buyRateNumerator!: number;

  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(1)
  buyRateDenominator!: number;

  @ApiProperty({ example: 400 })
  @IsInt()
  @Min(1)
  sellRateNumerator!: number;

  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(1)
  sellRateDenominator!: number;

  @ApiPropertyOptional({
    enum: ['now', 'next_session'],
    description:
      'Si une session est ouverte : now applique aux ops suivantes, next_session conserve les taux gelés.',
  })
  @IsOptional()
  @IsIn(['now', 'next_session'])
  applyMode?: 'now' | 'next_session';
}

export class OpeningBalanceItemDto {
  @ApiProperty({ example: 'XOF' })
  @IsString()
  currencyCode!: string;

  @ApiProperty({ example: 5000000 })
  @IsInt()
  @Min(0)
  amount!: number;
}

export class OpenFxSessionDto {
  @ApiProperty({ type: [OpeningBalanceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningBalanceItemDto)
  openingBalances!: OpeningBalanceItemDto[];
}

export class CountedBalanceItemDto {
  @ApiProperty({ example: 'NGN' })
  @IsString()
  currencyCode!: string;

  @ApiProperty({ example: 3000000 })
  @IsInt()
  @Min(0)
  amount!: number;
}

export class CloseFxSessionDto {
  @ApiProperty({ type: [CountedBalanceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountedBalanceItemDto)
  countedBalances!: CountedBalanceItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closingNote?: string;
}

export class CreateFxOperationDto {
  @ApiProperty({ enum: ['buy', 'sell'] })
  @IsIn(['buy', 'sell'])
  operationType!: 'buy' | 'sell';

  @ApiProperty({ example: 'XOF' })
  @IsString()
  fromCurrency!: string;

  @ApiProperty({ example: 500000 })
  @IsInt()
  @Min(1)
  fromAmount!: number;

  @ApiProperty({ example: 'NGN' })
  @IsString()
  toCurrency!: string;

  @ApiProperty({ example: 1250000 })
  @IsInt()
  @Min(1)
  toAmount!: number;

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateFxMovementDto {
  @ApiProperty({ example: 'NGN' })
  @IsString()
  currencyCode!: string;

  @ApiProperty({ enum: ['deposit', 'withdrawal', 'adjustment'] })
  @IsIn(['deposit', 'withdrawal', 'adjustment'])
  movementType!: 'deposit' | 'withdrawal' | 'adjustment';

  @ApiProperty({ example: 1000000 })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ListFxRateHistoryQueryDto {
  @ApiPropertyOptional({ example: 'NGN' })
  @IsOptional()
  @IsString()
  quoteCurrency?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ListFxOperationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sessionId?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class PreviewFxOperationDto {
  @ApiProperty({ enum: ['buy', 'sell'] })
  @IsIn(['buy', 'sell'])
  operationType!: 'buy' | 'sell';

  @ApiProperty({ example: 'XOF' })
  @IsString()
  fromCurrency!: string;

  @ApiProperty({ example: 500000 })
  @IsInt()
  @Min(1)
  fromAmount!: number;

  @ApiProperty({ example: 'NGN' })
  @IsString()
  toCurrency!: string;
}
