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
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Jeton à passer dans x-session-token',
  })
  sessionToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: AuthShopDto })
  shop: AuthShopDto;

  @ApiProperty({ example: 5, description: 'Durée d\'inactivité avant verrouillage (RG-AUTH-07)' })
  autoLockMinutes: number;

  @ApiProperty({ example: 1719225900000, description: 'Expiration de la session (epoch ms)' })
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
