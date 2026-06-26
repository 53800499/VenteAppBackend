import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
    description: 'Refresh token reçu au login ou au refresh précédent',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  refreshToken: string;
}
