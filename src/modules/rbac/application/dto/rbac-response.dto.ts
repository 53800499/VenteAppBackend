import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../../../shared/enums/permission.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto';

export class RoleCatalogItemDto {
  @ApiProperty({ enum: UserRole, example: UserRole.SELLER })
  code: UserRole;

  @ApiProperty({ example: 'Vendeur' })
  label: string;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];
}

export class PermissionCatalogItemDto {
  @ApiProperty({ example: 'sales:create' })
  code: Permission;

  @ApiProperty({ example: 'sales' })
  module: string;

  @ApiProperty({ example: 'create' })
  action: string;
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

export class RolesCatalogResponseDto extends ApiResponseDto<RoleCatalogItemDto[]> {
  @ApiProperty({ type: [RoleCatalogItemDto] })
  declare data: RoleCatalogItemDto[];
}

export class PermissionsCatalogResponseDto extends ApiResponseDto<PermissionCatalogItemDto[]> {
  @ApiProperty({ type: [PermissionCatalogItemDto] })
  declare data: PermissionCatalogItemDto[];
}

export class MyPermissionsResponseDto extends ApiResponseDto<MyPermissionsDataDto> {
  @ApiProperty({ type: MyPermissionsDataDto })
  declare data: MyPermissionsDataDto;
}
