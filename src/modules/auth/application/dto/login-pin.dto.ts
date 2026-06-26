import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class LoginPinDto {
  @ApiProperty({
    example: '1234',
    description: 'Code PIN à 4 ou 6 chiffres [RG-AUTH-01]',
    pattern: '^\\d{4,6}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,6}$/, {
    message: 'Le PIN doit comporter entre 4 et 6 chiffres numériques.',
  })
  pin: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Identifiant stable de l\'appareil (UUID généré côté client, stockage sécurisé)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  deviceId: string;

  @ApiPropertyOptional({
    example: 'Tablette caisse',
    description: 'Libellé affiché dans la liste des appareils connectés',
  })
  @IsOptional()
  @IsString()
  deviceLabel?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID utilisateur (optionnel en V1 mono-utilisateur)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID boutique active (défaut : 1)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  shopId?: number;
}
