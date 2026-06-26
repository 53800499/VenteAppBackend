import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto';

export class CreateShopDto {
  @ApiProperty({ example: 'Boutique Ganhi' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Cotonou, Ganhi' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+22990123456' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateShopDto {
  @ApiPropertyOptional({ example: 'Boutique Akpakpa Centre' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'Cotonou, Akpakpa' })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ example: '+22990123456' })
  @IsOptional()
  @IsString()
  phone?: string | null;
}

export class ShopListItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Boutique Akpakpa' })
  name: string;

  @ApiPropertyOptional({ example: 'Cotonou, Akpakpa', nullable: true })
  address: string | null;

  @ApiPropertyOptional({ example: '+22990123456', nullable: true })
  phone: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true, description: 'Boutique par défaut au login' })
  isDefault: boolean;

  @ApiProperty({ example: true, description: 'Boutique de la session courante' })
  isCurrent: boolean;
}

export class ShopListDataDto {
  @ApiProperty({ example: 1, description: 'Boutique active dans la session JWT' })
  activeShopId: number;

  @ApiProperty({ type: [ShopListItemDto] })
  shops: ShopListItemDto[];
}

export class ShopListResponseDto extends ApiResponseDto<ShopListDataDto> {
  @ApiProperty({ type: ShopListDataDto })
  declare data: ShopListDataDto;
}

export class ShopDetailDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Boutique Ganhi' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isDefault: boolean;

  @ApiProperty({ example: 1719225600000 })
  createdAt: number;
}

export class ShopDetailResponseDto extends ApiResponseDto<ShopDetailDto> {
  @ApiProperty({ type: ShopDetailDto })
  declare data: ShopDetailDto;
}

export class DeactivateShopDto {
  @ApiPropertyOptional({ example: 'Fermeture temporaire du point de vente Ganhi' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetDefaultShopResponseDto extends ApiResponseDto<{ id: number; isDefault: true }> {
  @ApiProperty({ example: { id: 2, isDefault: true } })
  declare data: { id: number; isDefault: true };
}
