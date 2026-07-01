import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SettingsShopSectionDto {
  @ApiProperty({ example: 'Boutique Amina' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Chemin local du logo' })
  logoPath: string | null;
}

export class SettingsLocalizationSectionDto {
  @ApiProperty({ example: 'FCFA', description: 'Lecture seule — RG-PARAM-01' })
  currency: string;

  @ApiProperty({ example: 'fr' })
  language: string;
}

export class SettingsInventorySectionDto {
  @ApiProperty({ description: 'Seuil stock faible par défaut' })
  defaultAlertThreshold: number;
}

export class SettingsSecuritySectionDto {
  @ApiProperty({ description: 'Délai verrouillage automatique (minutes)' })
  autoLockMinutes: number;
}

export class SettingsReceiptsSectionDto {
  @ApiPropertyOptional({ nullable: true })
  footer: string | null;
}

export class SettingsBackupSectionDto {
  @ApiPropertyOptional({ nullable: true })
  lastAt: number | null;

  @ApiPropertyOptional({ nullable: true })
  path: string | null;

  @ApiProperty({ description: 'true si dernière sauvegarde > 7 jours ou absente' })
  reminderRecommended: boolean;
}

export class SettingsSyncSectionDto {
  @ApiProperty()
  enabled: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastAt: number | null;
}

export class SettingsResponseDto {
  @ApiProperty({ type: SettingsShopSectionDto })
  shop: SettingsShopSectionDto;

  @ApiProperty({ type: SettingsLocalizationSectionDto })
  localization: SettingsLocalizationSectionDto;

  @ApiProperty({ type: SettingsInventorySectionDto })
  inventory: SettingsInventorySectionDto;

  @ApiProperty({ type: SettingsSecuritySectionDto })
  security: SettingsSecuritySectionDto;

  @ApiProperty({ type: SettingsReceiptsSectionDto })
  receipts: SettingsReceiptsSectionDto;

  @ApiProperty({ type: SettingsBackupSectionDto })
  backup: SettingsBackupSectionDto;

  @ApiProperty({ type: SettingsSyncSectionDto })
  sync: SettingsSyncSectionDto;

  @ApiProperty()
  updatedAt: number;

  @ApiProperty({
    description: 'Préférences notifications — voir GET /api/notifications/settings',
  })
  notificationsEndpoint: string;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'RG-PARAM-02 — obligatoire si fourni' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  shopName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  shopPhone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  shopAddress?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  shopLogoPath?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultAlertThreshold?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  autoLockMinutes?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptFooter?: string | null;
}

export class RecordBackupDto {
  @ApiPropertyOptional({ description: 'Chemin du fichier .venteapp généré (RG-PARAM-04)' })
  @IsOptional()
  @IsString()
  path?: string;
}

export class RecordBackupResponseDto {
  @ApiProperty({ type: SettingsBackupSectionDto })
  backup: SettingsBackupSectionDto;

  @ApiProperty()
  recordedAt: number;
}

export class UpdateSyncSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Epoch ms de la dernière sync cloud réussie' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lastSyncAt?: number;
}

export class UpdateSyncSettingsResponseDto {
  @ApiProperty({ type: SettingsSyncSectionDto })
  sync: SettingsSyncSectionDto;
}
