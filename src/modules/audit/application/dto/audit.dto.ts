import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ enum: AuditModule, description: 'Filtrer par module (RG-AUD-05)' })
  @IsOptional()
  @IsEnum(AuditModule)
  module?: AuditModule;

  @ApiPropertyOptional({ enum: AuditAction, description: 'Filtrer par type d\'action' })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Filtrer par utilisateur (vendeur)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({ example: 'debts' })
  @IsOptional()
  @IsString()
  entityTable?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entityId?: number;

  @ApiPropertyOptional({ description: 'Epoch ms début de période' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  from?: number;

  @ApiPropertyOptional({ description: 'Epoch ms fin de période' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  to?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AuditLogItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  action: string;

  @ApiProperty()
  actionLabel: string;

  @ApiProperty()
  module: string;

  @ApiProperty()
  moduleLabel: string;

  @ApiProperty()
  userId: number;

  @ApiPropertyOptional({ nullable: true })
  userName: string | null;

  @ApiProperty()
  entityId: number;

  @ApiProperty()
  entityTable: string;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  @ApiProperty()
  createdAt: number;

  @ApiProperty({ description: 'true si oldValue/newValue présents' })
  hasDiff: boolean;
}

export class AuditLogPaginationDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  hasMore: boolean;
}

export class AuditLogListResponseDto {
  @ApiProperty({ type: [AuditLogItemDto] })
  items: AuditLogItemDto[];

  @ApiProperty({ type: AuditLogPaginationDto })
  pagination: AuditLogPaginationDto;
}

export class AuditLogDetailDto extends AuditLogItemDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  oldValue: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  newValue: Record<string, unknown> | null;
}

export class AuditEntityHistoryResponseDto {
  @ApiProperty()
  entityTable: string;

  @ApiProperty()
  entityId: number;

  @ApiProperty({ type: [AuditLogDetailDto] })
  timeline: AuditLogDetailDto[];
}

export class AuditFilterOptionDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  label: string;
}

export class AuditFilterOptionsResponseDto {
  @ApiProperty({ type: [AuditFilterOptionDto] })
  modules: AuditFilterOptionDto[];

  @ApiProperty({ type: [AuditFilterOptionDto] })
  actions: AuditFilterOptionDto[];
}

export class ExportAuditLogsQueryDto extends ListAuditLogsQueryDto {
  @ApiPropertyOptional({ enum: ['json'], default: 'json', description: 'UC-22 — PDF généré côté mobile à partir du JSON' })
  @IsOptional()
  @IsEnum(['json'])
  format?: 'json';
}

export class AuditExportResponseDto {
  @ApiProperty()
  exportedAt: number;

  @ApiProperty()
  shopId: number;

  @ApiProperty()
  total: number;

  @ApiProperty({ type: [AuditLogDetailDto] })
  entries: AuditLogDetailDto[];

  @ApiProperty({ description: 'Indication pour génération PDF côté client (RG-AUD-07)' })
  pdfHint: string;
}
