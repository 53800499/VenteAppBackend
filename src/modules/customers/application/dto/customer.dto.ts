import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Kossi Mensah' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: '+22990123456', description: 'Fortement recommandé (RG-CLI-02)' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Client habituel du matin' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'Kossi Mensah' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: '+22990123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ListCustomersQueryDto {
  @ApiPropertyOptional({ example: 'kossi' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({ description: 'Uniquement les clients avec solde dû > 0' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasDebt?: boolean;

  @ApiPropertyOptional({ enum: ['name', 'debt', 'lastActivity'], default: 'name' })
  @IsOptional()
  @IsEnum(['name', 'debt', 'lastActivity'])
  sort?: 'name' | 'debt' | 'lastActivity';

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CustomerPhoneWarningDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  message: string;
}

export class CustomerSaleSummaryDto {
  @ApiProperty()
  id: number;

  @ApiPropertyOptional()
  receiptNumber: string | null;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: number;
}

export class CustomerResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty({ description: 'Solde dû calculé en temps réel (RG-CLI-05)' })
  balanceDue: number;

  @ApiProperty()
  openDebtsCount: number;

  @ApiProperty()
  purchaseCount: number;

  @ApiProperty()
  totalPurchases: number;

  @ApiPropertyOptional()
  lastActivityAt: number | null;

  @ApiProperty()
  createdAt: number;

  @ApiProperty()
  updatedAt: number;

  @ApiPropertyOptional({ type: CustomerPhoneWarningDto })
  phoneWarning?: CustomerPhoneWarningDto | null;

  @ApiPropertyOptional({ type: [CustomerSaleSummaryDto] })
  recentSales?: CustomerSaleSummaryDto[];
}

export class DebtorSummaryDto {
  @ApiProperty()
  customerId: number;

  @ApiProperty()
  customerName: string;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiProperty()
  balanceDue: number;

  @ApiProperty()
  openDebtsCount: number;

  @ApiProperty()
  oldestDebtAt: number;

  @ApiProperty()
  isCritical: boolean;
}

export class DebtorsListResponseDto {
  @ApiProperty()
  totalDebt: number;

  @ApiProperty()
  debtorCount: number;

  @ApiProperty({ type: [DebtorSummaryDto] })
  debtors: DebtorSummaryDto[];
}

export class DebtReminderResponseDto {
  @ApiProperty()
  customerId: number;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  balanceDue: number;

  @ApiProperty()
  message: string;

  @ApiProperty({ example: 'https://wa.me/22990123456?text=...' })
  whatsappUrl: string;
}

export class ArchiveCustomerResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  archived: boolean;
}
