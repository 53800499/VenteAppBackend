import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission } from '../../../../shared/enums/permission.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';

export class ShopUserListItemDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Amina Koffi' })
  name: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SELLER })
  role: UserRole;

  @ApiProperty({ example: 'Vendeur' })
  roleLabel: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  biometricEnabled: boolean;

  @ApiPropertyOptional({ example: 1719225600000, nullable: true })
  lastLoginAt: number | null;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];
}

export class CreateShopUserResponseDto {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 'Amina Koffi' })
  name: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SELLER })
  role: UserRole;

  @ApiProperty({ example: 1 })
  shopId: number;
}

export class ChangeUserRoleResponseDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Amina Koffi' })
  name: string;

  @ApiProperty({ enum: UserRole, example: UserRole.VIEWER })
  previousRole: UserRole;

  @ApiProperty({ enum: UserRole, example: UserRole.SELLER })
  role: UserRole;

  @ApiProperty({ example: 'Vendeur' })
  roleLabel: string;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];
}

export class DeactivateUserResponseDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: true })
  deactivated: boolean;
}

export class UserPermissionOverrideItemDto {
  @ApiProperty({ example: 'sales:cancel' })
  permissionCode: string;

  @ApiProperty({ enum: ['grant', 'deny'], example: 'grant' })
  effect: 'grant' | 'deny';

  @ApiPropertyOptional({ example: 'Autorisation temporaire inventaire' })
  reason?: string | null;

  @ApiPropertyOptional({ example: 1719225600000, nullable: true })
  expiresAt?: number | null;
}

export class UserAssignmentResponseDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Amina Koffi' })
  name: string;

  @ApiProperty({ example: 1 })
  shopId: number;

  @ApiProperty({ example: 'Boutique Centre' })
  shopName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SELLER })
  role: UserRole;

  @ApiProperty({ example: 'Vendeur' })
  roleLabel: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];

  @ApiProperty({ type: [UserPermissionOverrideItemDto] })
  overrides: UserPermissionOverrideItemDto[];
}

export class AssignUserShopResponseDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Amina Koffi' })
  name: string;

  @ApiProperty({ example: 1 })
  previousShopId: number;

  @ApiProperty({ example: 2 })
  shopId: number;

  @ApiProperty({ example: 'Succursale Akpakpa' })
  shopName: string;
}
