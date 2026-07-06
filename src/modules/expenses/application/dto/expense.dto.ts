import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListExpensesQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  createdBy?: number;

  @ApiPropertyOptional({ enum: ['cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check'] })
  @IsOptional()
  @IsEnum(['cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check'])
  paymentMethod?: 'cash' | 'mtn_momo' | 'moov_money' | 'card' | 'transfer' | 'check';

  @ApiPropertyOptional({ enum: ['draft', 'pending', 'validated', 'refused'] })
  @IsOptional()
  @IsEnum(['draft', 'pending', 'validated', 'refused'])
  status?: 'draft' | 'pending' | 'validated' | 'refused';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateExpenseCategoryDto {
  @ApiProperty({ example: 'Marketing' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: '#6366F1' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'campaign' })
  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateExpenseCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;
}

export class CreateExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiProperty({ example: 'Facture électricité' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 15000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Epoch ms' })
  @Type(() => Number)
  @IsInt()
  expenseDate: number;

  @ApiProperty({ enum: ['cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check'] })
  @IsEnum(['cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check'])
  paymentMethod: 'cash' | 'mtn_momo' | 'moov_money' | 'card' | 'transfer' | 'check';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  invoiceNumber?: string;

  @ApiPropertyOptional({ enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'], default: 'none' })
  @IsOptional()
  @IsEnum(['none', 'daily', 'weekly', 'monthly', 'yearly'])
  repeatSchedule?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

  @ApiPropertyOptional({ enum: ['draft', 'pending', 'validated', 'refused'], default: 'validated' })
  @IsOptional()
  @IsEnum(['draft', 'pending', 'validated', 'refused'])
  status?: 'draft' | 'pending' | 'validated' | 'refused';
}

export class UpdateExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  expenseDate?: number;

  @ApiPropertyOptional({ enum: ['cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check'] })
  @IsOptional()
  @IsEnum(['cash', 'mtn_momo', 'moov_money', 'card', 'transfer', 'check'])
  paymentMethod?: 'cash' | 'mtn_momo' | 'moov_money' | 'card' | 'transfer' | 'check';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] })
  @IsOptional()
  @IsEnum(['none', 'daily', 'weekly', 'monthly', 'yearly'])
  repeatSchedule?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

  @ApiPropertyOptional({ enum: ['draft', 'pending', 'validated', 'refused'] })
  @IsOptional()
  @IsEnum(['draft', 'pending', 'validated', 'refused'])
  status?: 'draft' | 'pending' | 'validated' | 'refused';
}

export class UpsertCategoryBudgetDto {
  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyAmount: number;
}

export class GetExpenseProfitQueryDto {
  @ApiPropertyOptional({ enum: ['today', 'week', 'month', 'custom'], default: 'month' })
  @IsOptional()
  @IsEnum(['today', 'week', 'month', 'custom'])
  period?: 'today' | 'week' | 'month' | 'custom';

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
