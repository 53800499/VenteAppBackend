import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto';
import { ShopAccessGrantDto } from './user-shop-access.dto';

export { ShopAccessGrantDto } from './user-shop-access.dto';

export class SyncUserShopAccessDto {
  @ApiProperty({ type: [ShopAccessGrantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShopAccessGrantDto)
  shops: ShopAccessGrantDto[];
}

export class SyncUserShopAccessResultDto {
  @ApiProperty({ example: 4 })
  userId: number;

  @ApiProperty({ example: 12 })
  membershipId: number;

  @ApiProperty({ type: [ShopAccessGrantDto] })
  shops: ShopAccessGrantDto[];
}

export class SyncUserShopAccessResponseDto extends ApiResponseDto<SyncUserShopAccessResultDto> {
  @ApiProperty({ type: SyncUserShopAccessResultDto })
  declare data: SyncUserShopAccessResultDto;
}
