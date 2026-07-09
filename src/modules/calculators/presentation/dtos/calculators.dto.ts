import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class ToggleModuleDto {
  @ApiProperty({ description: 'Activer ou désactiver le module' })
  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;
}

export class UpsertProductDataDto {
  @ApiProperty({ description: 'ID du produit' })
  @IsNumber()
  @IsNotEmpty()
  productId: number;

  @ApiProperty({ description: 'Type de calculateur' })
  @IsString()
  @IsNotEmpty()
  calculatorType: string;

  @ApiProperty({ description: 'Métadonnées du calculateur' })
  @IsObject()
  @IsNotEmpty()
  metadata: Record<string, any>;
}

export class CreateHistoryDto {
  @ApiProperty({ description: 'Type de calculateur' })
  @IsString()
  @IsNotEmpty()
  calculatorType: string;

  @ApiProperty({ description: 'Entrées du calcul' })
  @IsObject()
  @IsNotEmpty()
  input: Record<string, any>;

  @ApiProperty({ description: 'Résultats du calcul' })
  @IsObject()
  @IsNotEmpty()
  result: Record<string, any>;

  @ApiProperty({ description: 'Ajouter aux favoris', required: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiProperty({ description: 'Libellé / Nom du calcul', required: false })
  @IsOptional()
  @IsString()
  label?: string;
}
