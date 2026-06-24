import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { UserRole } from '../../../../shared/enums/user-role.enum';

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

  @ApiProperty({ enum: [UserRole.SELLER, UserRole.VIEWER], example: UserRole.SELLER })
  @IsEnum(UserRole)
  role: UserRole.SELLER | UserRole.VIEWER;
}

export class ChangeUserRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.SELLER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: 'Promotion vendeur senior' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
