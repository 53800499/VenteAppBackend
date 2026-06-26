import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission } from '../../../../shared/enums/permission.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto';

export class LockScreenUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Kofi Agbovi' })
  name: string;

  @ApiProperty({ enum: UserRole, example: UserRole.OWNER })
  role: UserRole;

  @ApiProperty({ example: false })
  biometricEnabled: boolean;
}

export class LockScreenDataDto {
  @ApiProperty({ example: 1, description: 'ID de la boutique active' })
  shopId: number;

  @ApiProperty({ example: 'Ma Boutique', description: 'Nom affiché sur ECR-01' })
  shopName: string;

  @ApiPropertyOptional({
    example: '/storage/logo.png',
    nullable: true,
    description: 'Chemin local du logo boutique',
  })
  shopLogoPath: string | null;

  @ApiProperty({ type: [LockScreenUserDto] })
  users: LockScreenUserDto[];
}

export class LockScreenResponseDto extends ApiResponseDto<LockScreenDataDto> {
  @ApiProperty({ type: LockScreenDataDto })
  declare data: LockScreenDataDto;
}

export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Kofi Agbovi' })
  name: string;

  @ApiProperty({ enum: UserRole, example: UserRole.OWNER })
  role: UserRole;

  @ApiProperty({ example: 'Patron' })
  roleLabel: string;

  @ApiProperty({ example: 1 })
  shopId: number;

  @ApiProperty({ example: false })
  biometricEnabled: boolean;

  @ApiProperty({ example: 1719225600000, description: 'Timestamp ms du dernier login' })
  lastLoginAt: number | null;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];
}

export class AuthShopDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Ma Boutique' })
  name: string;
}

export class LoginSuccessDataDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token — à passer en `Authorization: Bearer <token>`',
  })
  accessToken: string;

  @ApiProperty({
    example: 'a1b2c3d4e5f6...',
    description: 'Refresh token opaque — à stocker de façon sécurisée côté client',
  })
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ example: 1719226500000, description: 'Expiration du JWT access (epoch ms)' })
  accessExpiresAt: number;

  @ApiProperty({ example: 1721817600000, description: 'Expiration du refresh token (epoch ms)' })
  refreshExpiresAt: number;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: AuthShopDto })
  shop: AuthShopDto;

  @ApiProperty({ example: 5, description: 'Durée d\'inactivité avant verrouillage (RG-AUTH-07)' })
  autoLockMinutes: number;

  @ApiProperty({ example: 1719225900000, description: 'Expiration session inactivité (epoch ms)' })
  expiresAt: number;
}

export class LoginSuccessResponseDto extends ApiResponseDto<LoginSuccessDataDto> {
  @ApiProperty({ type: LoginSuccessDataDto })
  declare data: LoginSuccessDataDto;
}

export class SetupOwnerDataDto {
  @ApiProperty({ example: 1 })
  shopId: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({
    example: 'a1b2c3d4e5f67890...',
    description: 'Jeton de récupération — à sauvegarder hors appareil (affiché une seule fois, RG-AUTH-08)',
  })
  recoveryToken: string;

  @ApiProperty({
    example: 'Installation réussie. Sauvegardez le fichier de récupération d\'urgence en lieu sûr.',
  })
  message: string;
}

export class SetupOwnerResponseDto extends ApiResponseDto<SetupOwnerDataDto> {
  @ApiProperty({ type: SetupOwnerDataDto })
  declare data: SetupOwnerDataDto;
}

export class EmergencyUnlockDataDto extends LoginSuccessDataDto {
  @ApiProperty({ example: 'Déblocage d\'urgence réussi.' })
  message: string;
}

export class EmergencyUnlockResponseDto extends ApiResponseDto<EmergencyUnlockDataDto> {
  @ApiProperty({ type: EmergencyUnlockDataDto })
  declare data: EmergencyUnlockDataDto;
}

export class EnableBiometricDataDto {
  @ApiProperty({ example: true })
  biometricEnabled: boolean;
}

export class EnableBiometricResponseDto extends ApiResponseDto<EnableBiometricDataDto> {
  @ApiProperty({ type: EnableBiometricDataDto })
  declare data: EnableBiometricDataDto;
}

export class TouchSessionDataDto {
  @ApiProperty({ example: null, nullable: true, description: 'Aucune donnée — session prolongée' })
  result: null;
}

export class TouchSessionResponseDto extends ApiResponseDto<Record<string, never>> {
  @ApiProperty({ example: {} })
  declare data: Record<string, never>;
}

export class TokenRefreshDataDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'new-refresh-token-hex...' })
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ example: 1719226500000 })
  accessExpiresAt: number;

  @ApiProperty({ example: 1721817600000 })
  refreshExpiresAt: number;

  @ApiProperty({ example: 1719225900000, description: 'Expiration session inactivité (epoch ms)' })
  expiresAt: number;
}

export class TokenRefreshResponseDto extends ApiResponseDto<TokenRefreshDataDto> {
  @ApiProperty({ type: TokenRefreshDataDto })
  declare data: TokenRefreshDataDto;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  loggedOut: boolean;
}

export class DeviceSessionDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 'Kofi Agbovi' })
  userName: string;

  @ApiProperty({ example: 'device-uuid-stable' })
  deviceId: string;

  @ApiPropertyOptional({ example: 'Tablette caisse', nullable: true })
  deviceLabel: string | null;

  @ApiProperty({ example: 1719225600000 })
  lastSeenAt: number;

  @ApiProperty({ example: 1719225900000, description: 'Expiration session inactivité (epoch ms)' })
  sessionExpiresAt: number;

  @ApiProperty({ example: 1721817600000, description: 'Expiration refresh token (epoch ms)' })
  refreshExpiresAt: number;

  @ApiProperty({ example: true, description: 'True si c\'est la session de la requête courante' })
  isCurrent: boolean;
}

export class DeviceSessionListResponseDto extends ApiResponseDto<DeviceSessionDto[]> {
  @ApiProperty({ type: [DeviceSessionDto] })
  declare data: DeviceSessionDto[];
}

export class RevokeDeviceSessionDataDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: true })
  revoked: boolean;
}

export class RevokeDeviceSessionResponseDto extends ApiResponseDto<RevokeDeviceSessionDataDto> {
  @ApiProperty({ type: RevokeDeviceSessionDataDto })
  declare data: RevokeDeviceSessionDataDto;
}

export class SwitchShopDataDto {
  @ApiProperty({ example: 2 })
  activeShopId: number;

  @ApiProperty({ example: { id: 2, name: 'Boutique Ganhi' } })
  shop: { id: number; name: string };
}

export class SwitchShopResponseDto extends ApiResponseDto<SwitchShopDataDto> {
  @ApiProperty({ type: SwitchShopDataDto })
  declare data: SwitchShopDataDto;
}
