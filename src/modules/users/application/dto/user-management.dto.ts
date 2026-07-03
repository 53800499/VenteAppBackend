import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class CreateShopUserDto {
  @ApiProperty({ example: 'Amina Koffi' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: '5678', description: 'PIN 4 à 6 chiffres' })
  @IsString()
  @Matches(/^\d{4,6}$/)
  pin: string;

  @ApiProperty({ example: '+22997123456', description: 'WhatsApp pour connexion OTP' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  phone: string;

  @ApiProperty({
    example: 'seller',
    description: 'Code rôle (seller, viewer ou rôle boutique shop_{id}_{slug})',
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class DeactivateUserDto {
  @ApiPropertyOptional({ example: 'Départ du vendeur', description: 'Motif enregistré dans l\'audit' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}

export class AssignUserShopDto {
  @ApiProperty({ example: 2, description: 'ID de la boutique cible (doit appartenir au patron)' })
  @IsInt()
  @Min(1)
  shopId: number;

  @ApiPropertyOptional({ example: 'Transfert vers succursale Akpakpa' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}

export class ChangeUserRoleDto {
  @ApiProperty({
    example: 'seller',
    description: 'Code rôle (seller, viewer ou rôle boutique shop_{id}_{slug})',
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiPropertyOptional({ example: 'Promotion vendeur senior' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
