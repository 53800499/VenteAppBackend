import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto';

export class ShopAccessGrantDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  shopId: number;

  @ApiPropertyOptional({
    example: 'viewer',
    description: 'Rôle effectif dans cette boutique (null = rôle global du membership)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  accessRole?: string | null;
}

export class UserShopAccessEntryDto {
  @ApiProperty({ example: 2 })
  shopId: number;

  @ApiProperty({ example: 'Porto' })
  shopName: string;

  @ApiPropertyOptional({ example: 'viewer', nullable: true })
  accessRole?: string | null;

  @ApiProperty({ example: 'viewer' })
  effectiveRole: string;

  @ApiProperty({ example: 'Lecteur' })
  effectiveRoleLabel: string;
}

export class UserShopAccessDto {
  @ApiProperty({ example: 4 })
  userId: number;

  @ApiProperty({ example: 12 })
  membershipId: number;

  @ApiProperty({ example: 'seller' })
  role: string;

  @ApiProperty({ example: 'Vendeur' })
  roleLabel: string;

  @ApiProperty({ type: [UserShopAccessEntryDto] })
  shops: UserShopAccessEntryDto[];
}

export class UserShopAccessResponseDto extends ApiResponseDto<UserShopAccessDto> {
  @ApiProperty({ type: UserShopAccessDto })
  declare data: UserShopAccessDto;
}
