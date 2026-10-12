import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
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

export class SubmitCashSessionClosingDto {
  @ApiProperty({ description: 'Espèces réellement comptées' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedCash!: number;

  @ApiProperty({ description: 'Mobile Money réellement compté / vérifié' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedMomo!: number;

  @ApiPropertyOptional({ description: 'Note ou observation générale de clôture' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  closingNote?: string;

  @ApiProperty({ description: 'Total des ventes en espèces' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salesCash!: number;

  @ApiProperty({ description: 'Total des ventes en Mobile Money' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salesMomo!: number;

  @ApiProperty({ description: 'Total des dépenses en espèces' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expensesCash!: number;

  @ApiProperty({ description: 'Total des dépenses en Mobile Money' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expensesMomo!: number;

  @ApiProperty({ description: 'Entrées diverses en espèces' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  depositsCash!: number;

  @ApiProperty({ description: 'Entrées diverses en Mobile Money' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  depositsMomo!: number;

  @ApiProperty({ description: 'Retraits / sorties diverses en espèces' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  withdrawalsCash!: number;

  @ApiProperty({ description: 'Retraits / sorties diverses en Mobile Money' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  withdrawalsMomo!: number;

  @ApiProperty({ description: 'Nombre de ventes conclues' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  saleCount!: number;

  @ApiPropertyOptional({
    description: 'Catégorie de justification si écart constaté',
    enum: [
      'unconfirmed_payment',
      'pending_transaction',
      'entry_error',
      'unrecorded_expense',
      'network_fee',
      'cash_breakage',
      'other',
    ],
  })
  @IsOptional()
  @IsString()
  justificationCategory?: string;

  @ApiPropertyOptional({ description: 'Explication détaillée de l’écart par l’employé' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificationNote?: string;
}

export class CloseCashSessionDto extends SubmitCashSessionClosingDto {
  @ApiPropertyOptional({ description: 'PIN patron (optionnel si validation sur place)' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  ownerPin?: string;
}

export class ApproveCashSessionDto {
  @ApiPropertyOptional({ description: 'Commentaire ou décision du responsable' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class ReopenCashSessionDto {
  @ApiProperty({ description: 'Motif de réouverture obligatoire' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class CreateCashMovementDto {
  @ApiProperty({ enum: ['deposit', 'withdrawal', 'owner_drop', 'bank_deposit'] })
  @IsString()
  @IsIn(['deposit', 'withdrawal', 'owner_drop', 'bank_deposit'])
  movementType!: 'deposit' | 'withdrawal' | 'owner_drop' | 'bank_deposit';

  @ApiProperty({ enum: ['cash', 'momo', 'mtn_momo', 'moov_money', 'celtis', 'bank', 'other'] })
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

export class OwnerDropCashDto {
  @ApiProperty({ enum: ['cash', 'mtn_momo', 'moov_money', 'celtis', 'bank'], default: 'cash' })
  @IsString()
  registerType: string = 'cash';

  @ApiProperty({ description: 'Montant remis au patron (FCFA)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ description: 'Note ou reçu de remise' })
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
