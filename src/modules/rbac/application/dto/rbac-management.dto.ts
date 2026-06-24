import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RolePermissionGrantDto {
  @ApiProperty({ example: 'sales:create' })
  @IsString()
  @IsNotEmpty()
  permissionCode: string;

  @ApiProperty({ enum: ['allow', 'deny'], example: 'allow' })
  @IsIn(['allow', 'deny'])
  effect: 'allow' | 'deny';
}

export class CreateShopRoleDto {
  @ApiProperty({ example: 'caissier', description: 'Identifiant court (slug)' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{2,30}$/, {
    message: 'Le code doit commencer par une lettre et contenir 3 à 31 caractères (a-z, 0-9, _).',
  })
  slug: string;

  @ApiProperty({ example: 'Caissier' })
  @IsString()
  @MaxLength(80)
  label: string;

  @ApiPropertyOptional({ example: 'Encaissement uniquement' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'viewer', description: 'Rôle parent pour héritage' })
  @IsOptional()
  @IsString()
  parentRoleCode?: string;

  @ApiProperty({ type: [RolePermissionGrantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RolePermissionGrantDto)
  permissions: RolePermissionGrantDto[];
}

export class UpdateShopRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [RolePermissionGrantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionGrantDto)
  permissions?: RolePermissionGrantDto[];
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [RolePermissionGrantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionGrantDto)
  permissions: RolePermissionGrantDto[];
}

export class CreatePermissionOverrideDto {
  @ApiProperty({ example: 'sales:cancel' })
  @IsString()
  permissionCode: string;

  @ApiProperty({ enum: ['grant', 'deny'] })
  @IsIn(['grant', 'deny'])
  effect: 'grant' | 'deny';

  @ApiPropertyOptional({ example: 'Autorisé temporairement pour inventaire' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Expiration (epoch ms)' })
  @IsOptional()
  expiresAt?: number;
}
