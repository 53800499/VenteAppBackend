import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class RecordDebtPaymentDto {
  @ApiProperty({ example: 5000, description: 'Montant remboursé en FCFA (RG-DET-04)' })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ enum: ['cash', 'mtn_momo', 'moov_money', 'other'] })
  @IsEnum(['cash', 'mtn_momo', 'moov_money', 'other'])
  method: 'cash' | 'mtn_momo' | 'moov_money' | 'other';

  @ApiPropertyOptional({
    example: '+22990123456',
    description: 'Téléphone ou référence transaction (obligatoire Mobile Money — RG-PAY-02)',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    example: 10000,
    description: 'Montant remis en espèces (RG-PAY-01 — monnaie calculée automatiquement)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountTendered?: number;

  @ApiPropertyOptional({ example: 'Acompte client régulier' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ForgiveDebtDto {
  @ApiProperty({
    example: 'Geste commercial — client fidèle depuis 5 ans',
    description: 'Motif obligatoire, minimum 10 caractères (RG-DET-12)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason: string;
}

export class ListDebtsQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'partial', 'paid', 'cancelled', 'forgiven'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number;

  @ApiPropertyOptional({
    description: 'Dettes ouvertes > 30 jours sans remboursement (RG-DET-10)',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  criticalOnly?: boolean;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class DebtPaymentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  paymentId: number;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional()
  reference: string | null;

  @ApiProperty()
  createdAt: number;
}

export class DebtResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  customerId: number;

  @ApiPropertyOptional()
  customerName: string | null;

  @ApiPropertyOptional()
  saleId: number | null;

  @ApiProperty()
  originalAmount: number;

  @ApiProperty()
  amountPaid: number;

  @ApiProperty()
  amountRemaining: number;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  dueAt: number | null;

  @ApiProperty()
  createdAt: number;

  @ApiProperty()
  updatedAt: number;

  @ApiProperty()
  isCritical: boolean;

  @ApiProperty({ description: 'Jours sans remboursement (RG-DET-08)' })
  daysWithoutPayment: number;

  @ApiPropertyOptional()
  lastPaymentAt: number | null;

  @ApiPropertyOptional({ type: [DebtPaymentResponseDto] })
  payments?: DebtPaymentResponseDto[];
}

export class DebtsSummaryResponseDto {
  @ApiProperty()
  totalDebt: number;

  @ApiProperty()
  openDebtsCount: number;

  @ApiProperty()
  criticalDebtsCount: number;

  @ApiProperty()
  debtorCount: number;
}

export class DebtAuditEntryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  action: string;

  @ApiPropertyOptional()
  userName: string | null;

  @ApiPropertyOptional()
  reason: string | null;

  @ApiPropertyOptional()
  oldValue: Record<string, unknown> | null;

  @ApiPropertyOptional()
  newValue: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: number;
}

export class DebtHistoryResponseDto {
  @ApiProperty()
  debtId: number;

  @ApiProperty({ type: [DebtAuditEntryDto] })
  timeline: DebtAuditEntryDto[];

  @ApiProperty({ type: [DebtPaymentResponseDto] })
  payments: DebtPaymentResponseDto[];
}

export class RecordDebtPaymentResponseDto {
  @ApiProperty()
  debtId: number;

  @ApiProperty()
  paymentId: number;

  @ApiProperty({ example: 'PAY-20250626-0001' })
  receiptNumber: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  changeGiven: number;

  @ApiProperty()
  amountRemaining: number;

  @ApiProperty()
  status: string;
}

export class ForgiveDebtResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  forgivenAt: number;
}
