import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission } from '../../../../shared/enums/permission.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto';

export class RolePermissionGrantResponseDto {
  @ApiProperty({ example: 'sales:create' })
  permissionCode: string;

  @ApiProperty({ enum: ['allow', 'deny'], example: 'allow' })
  effect: 'allow' | 'deny';
}

export class RoleCatalogItemDto {
  @ApiProperty({ example: 'seller' })
  code: string;

  @ApiProperty({ example: 'Vendeur' })
  label: string;

  @ApiPropertyOptional({ example: 'Encaissement et ventes' })
  description?: string | null;

  @ApiProperty({ enum: ['system', 'shop'], example: 'system' })
  scope: string;

  @ApiPropertyOptional({ example: 1, nullable: true })
  shopId: number | null;

  @ApiProperty({ example: true })
  isSystem: boolean;

  @ApiProperty({ example: 50 })
  priority: number;

  @ApiProperty({ type: [String], example: ['viewer'] })
  parentRoles: string[];

  @ApiProperty({ type: [RolePermissionGrantResponseDto] })
  permissions: RolePermissionGrantResponseDto[];
}

export class PermissionModuleDto {
  @ApiProperty({ example: 'inventory' })
  code: string;

  @ApiProperty({ example: 'Inventaire' })
  label: string;

  @ApiPropertyOptional({ example: 'Gestion du catalogue et du stock' })
  description?: string | null;
}

export class PermissionCatalogItemDto {
  @ApiProperty({ example: 'inventory:read' })
  code: string;

  @ApiProperty({ example: 'inventory' })
  module: string;

  @ApiProperty({ example: 'read' })
  action: string;

  @ApiProperty({ example: 'Lire inventaire' })
  label: string;

  @ApiPropertyOptional({ example: 'Consulter le stock' })
  description?: string | null;
}

export class PermissionsCatalogDataDto {
  @ApiProperty({ type: [PermissionModuleDto] })
  modules: PermissionModuleDto[];

  @ApiProperty({ type: [PermissionCatalogItemDto] })
  permissions: PermissionCatalogItemDto[];
}

export class MyPermissionsDataDto {
  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 1 })
  shopId: number;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ example: 'Patron' })
  roleLabel: string;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];
}

export class CheckPermissionDataDto {
  @ApiProperty({ example: 'sales:cancel' })
  permission: string;

  @ApiProperty({ example: false })
  granted: boolean;

  @ApiProperty({ enum: UserRole, example: UserRole.SELLER })
  role: UserRole;
}

export class UserPermissionOverrideDto {
  @ApiProperty({ example: 'sales:cancel' })
  permissionCode: string;

  @ApiProperty({ enum: ['grant', 'deny'] })
  effect: 'grant' | 'deny';

  @ApiPropertyOptional({ example: 'Autorisé temporairement' })
  reason?: string | null;

  @ApiPropertyOptional({ example: 1720000000000, nullable: true })
  expiresAt?: number | null;
}

export class RolesCatalogResponseDto extends ApiResponseDto<RoleCatalogItemDto[]> {
  @ApiProperty({ type: [RoleCatalogItemDto] })
  declare data: RoleCatalogItemDto[];
}

export class RoleDetailResponseDto extends ApiResponseDto<RoleCatalogItemDto> {
  @ApiProperty({ type: RoleCatalogItemDto })
  declare data: RoleCatalogItemDto;
}

export class PermissionsCatalogResponseDto extends ApiResponseDto<PermissionsCatalogDataDto> {
  @ApiProperty({ type: PermissionsCatalogDataDto })
  declare data: PermissionsCatalogDataDto;
}

export class MyPermissionsResponseDto extends ApiResponseDto<MyPermissionsDataDto> {
  @ApiProperty({ type: MyPermissionsDataDto })
  declare data: MyPermissionsDataDto;
}

export class CheckPermissionResponseDto extends ApiResponseDto<CheckPermissionDataDto> {
  @ApiProperty({ type: CheckPermissionDataDto })
  declare data: CheckPermissionDataDto;
}

export class UserOverridesResponseDto extends ApiResponseDto<UserPermissionOverrideDto[]> {
  @ApiProperty({ type: [UserPermissionOverrideDto] })
  declare data: UserPermissionOverrideDto[];
}

export class UserEffectivePermissionsDataDto {
  @ApiProperty({ example: 2 })
  userId: number;

  @ApiProperty({ enum: UserRole, example: UserRole.SELLER })
  role: UserRole;

  @ApiProperty({ example: 'Vendeur' })
  roleLabel: string;

  @ApiProperty({ example: 1 })
  shopId: number;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];
}

export class UserEffectivePermissionsResponseDto extends ApiResponseDto<UserEffectivePermissionsDataDto> {
  @ApiProperty({ type: UserEffectivePermissionsDataDto })
  declare data: UserEffectivePermissionsDataDto;
}

export class UserPermissionOverridesReplaceDataDto {
  @ApiProperty({ example: 2 })
  userId: number;

  @ApiProperty({ type: [UserPermissionOverrideDto] })
  overrides: UserPermissionOverrideDto[];

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];
}

export class UserPermissionOverridesReplaceResponseDto extends ApiResponseDto<UserPermissionOverridesReplaceDataDto> {
  @ApiProperty({ type: UserPermissionOverridesReplaceDataDto })
  declare data: UserPermissionOverridesReplaceDataDto;
}
