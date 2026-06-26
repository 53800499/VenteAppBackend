import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class SetupOwnerDto {
  @ApiProperty({ example: 'Kofi Agbovi', description: 'Nom complet du patron' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  ownerName: string;

  @ApiProperty({ example: 'Boutique Akpakpa', description: 'Nom de la boutique' })
  @IsString()
  @IsNotEmpty()
  shopName: string;

  @ApiProperty({
    example: '1234',
    description: 'PIN initial hashé bcrypt cost 10 [RG-AUTH-02]',
    pattern: '^\\d{4,6}$',
  })
  @IsString()
  @Matches(/^\d{4,6}$/, {
    message: 'Le PIN doit comporter entre 4 et 6 chiffres numériques.',
  })
  pin: string;

  @ApiPropertyOptional({ example: 'Cotonou, Akpakpa' })
  @IsOptional()
  @IsString()
  shopAddress?: string;

  @ApiPropertyOptional({ example: '+22990123456' })
  @IsOptional()
  @IsString()
  shopPhone?: string;

  @ApiProperty({
    example: '+22997123456',
    description: 'WhatsApp du patron pour la connexion OTP',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  ownerPhone: string;
}

export class EmergencyUnlockDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
    description: 'Jeton du fichier de récupération d\'urgence [RG-AUTH-08]',
  })
  @IsString()
  @IsNotEmpty()
  recoveryToken: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Identifiant stable de l\'appareil (UUID côté client)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  deviceId: string;

  @ApiPropertyOptional({ example: 'Tablette caisse' })
  @IsOptional()
  @IsString()
  deviceLabel?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  shopId?: number;
}

export class EnableBiometricDto {
  @ApiProperty({
    example: '1234',
    description: 'PIN courant pour confirmer l\'activation [RG-AUTH-05]',
    pattern: '^\\d{4,6}$',
  })
  @IsString()
  @Matches(/^\d{4,6}$/)
  pin: string;
}
