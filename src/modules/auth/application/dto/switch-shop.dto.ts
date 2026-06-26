import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SwitchShopDto {
  @ApiProperty({ example: 2, description: 'ID de la boutique cible (boutique par défaut de la session)' })
  @IsInt()
  @Min(1)
  shopId: number;
}
