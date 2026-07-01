import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class NotificationPreferencesDto {
  @ApiProperty()
  enableStockAlerts: boolean;

  @ApiProperty()
  enableDebtReminders: boolean;

  @ApiProperty({ description: 'Jours sans paiement avant rappel (RG-NOTIF-02)' })
  debtReminderDays: number;

  @ApiProperty()
  enableDailySummary: boolean;

  @ApiProperty({ example: '20:00', description: 'Heure locale Bénin (HH:mm)' })
  dailySummaryTime: string;

  @ApiProperty()
  enableBackupReminder: boolean;

  @ApiProperty()
  enableGoodDayAlert: boolean;

  @ApiProperty()
  defaultAlertThreshold: number;

  @ApiPropertyOptional({ nullable: true })
  backupLastAt: number | null;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableStockAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableDebtReminders?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  debtReminderDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableDailySummary?: boolean;

  @ApiPropertyOptional({ example: '20:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'dailySummaryTime doit être au format HH:mm' })
  dailySummaryTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableBackupReminder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableGoodDayAlert?: boolean;
}

export class DebtReminderQuotaDto {
  @ApiProperty()
  sent: number;

  @ApiProperty()
  max: number;

  @ApiProperty()
  remaining: number;

  @ApiProperty({ description: 'Clé jour fuseau Bénin (YYYYMMDD)' })
  dayKey: string;
}

export class NotificationItemDto {
  @ApiProperty({ enum: ['N-01', 'N-02', 'N-03', 'N-04', 'N-05', 'N-06', 'N-07'] })
  code: string;

  @ApiProperty()
  channel: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  deepLink: string;

  @ApiProperty()
  configurable: boolean;

  @ApiProperty()
  alwaysOn: boolean;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload: Record<string, unknown>;
}

export class DailySummaryPreviewDto {
  @ApiProperty()
  eligible: boolean;

  @ApiProperty()
  scheduledTime: string;

  @ApiProperty()
  saleCount: number;

  @ApiProperty()
  totalRevenue: number;

  @ApiPropertyOptional()
  reason?: string;
}

export class SyncConflictSummaryDto {
  @ApiProperty()
  count: number;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  entities: { table: string; id: number }[];
}

export class NotificationFeedDto {
  @ApiProperty({ type: NotificationPreferencesDto })
  preferences: NotificationPreferencesDto;

  @ApiProperty({ type: DebtReminderQuotaDto })
  debtReminderQuota: DebtReminderQuotaDto;

  @ApiProperty({ type: DailySummaryPreviewDto })
  dailySummary: DailySummaryPreviewDto;

  @ApiProperty({ type: SyncConflictSummaryDto })
  syncConflicts: SyncConflictSummaryDto;

  @ApiProperty({ type: [NotificationItemDto] })
  items: NotificationItemDto[];

  @ApiProperty()
  generatedAt: number;
}

export class AckNotificationDto {
  @ApiProperty({ enum: ['debt_reminder'], description: 'Type d\'acquittement' })
  @IsIn(['debt_reminder'])
  type: 'debt_reminder';

  @ApiProperty({ minimum: 1, maximum: 3, description: 'Nombre de rappels dette affichés (RG-NOTIF-03)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  count: number;
}

export class AckNotificationResponseDto {
  @ApiProperty({ type: DebtReminderQuotaDto })
  debtReminderQuota: DebtReminderQuotaDto;
}
