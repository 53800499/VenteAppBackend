import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export enum ProductSortQuery {
  NAME = 'name',
  STOCK = 'stock',
  PRICE = 'price',
}

export class ListProductsQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filtrer par ID catégorie' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ example: 'riz', description: 'Recherche insensible à la casse sur nom ou SKU' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: true, description: 'Uniquement les produits dont le stock <= seuil d\'alerte' })
  @IsOptional()
  @Type(() => Boolean)
  lowStock?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Inclure les produits archivés (défaut : false — RG-INV-08)' })
  @IsOptional()
  @Type(() => Boolean)
  includeArchived?: boolean;

  @ApiPropertyOptional({ enum: ProductSortQuery, default: ProductSortQuery.NAME, description: 'Tri : name | stock | price' })
  @IsOptional()
  @IsEnum(ProductSortQuery)
  sort?: ProductSortQuery;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Riz parfumé 25kg' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId: number;

  @ApiPropertyOptional({ example: 'RIZ-25' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ example: 15000, description: 'Prix de vente en FCFA (entier > 0)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceSell: number;

  @ApiPropertyOptional({ example: 12000, description: 'Prix d\'achat en FCFA' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceBuy?: number;

  @ApiProperty({ example: 50, description: 'Quantité initiale (RG-INV-04)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  initialQuantity: number;

  @ApiPropertyOptional({ example: 5, description: 'Seuil d\'alerte (défaut 5 — RG-INV-06)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  alertThreshold?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Riz parfumé 25kg premium' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({ example: 'RIZ-25-P' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 16000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceSell?: number;

  @ApiPropertyOptional({ example: 12500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceBuy?: number | null;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  alertThreshold?: number;
}

export enum StockAdjustmentTypeDto {
  RESTOCK = 'restock',
  LOSS = 'loss',
  ADJUSTMENT = 'adjustment',
}

export class StockAdjustmentDto {
  @ApiProperty({ enum: StockAdjustmentTypeDto, example: StockAdjustmentTypeDto.RESTOCK })
  @IsEnum(StockAdjustmentTypeDto)
  type: StockAdjustmentTypeDto;

  @ApiProperty({
    example: 10,
    description: 'Variation (+ entrée, - sortie). Ex. restock +10, loss -3',
  })
  @Type(() => Number)
  @IsInt()
  quantityChange: number;

  @ApiPropertyOptional({ example: 'Réapprovisionnement fournisseur', description: 'Obligatoire pour loss/adjustment (RG-INV-10)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;

  @ApiPropertyOptional({ example: 11000, description: 'Coût unitaire sur restock (RG-INV-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitCost?: number;
}

export class ProductResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'Riz parfumé 25kg' })
  name: string;

  @ApiPropertyOptional({ example: 1 })
  categoryId: number | null;

  @ApiPropertyOptional({ example: 'RIZ-25', nullable: true })
  sku: string | null;

  @ApiProperty({ example: 48, description: 'Quantité en stock actuelle' })
  quantityInStock: number;

  @ApiProperty({ example: 5, description: 'Seuil d\'alerte effectif (produit ou défaut boutique)' })
  alertThreshold: number;

  @ApiPropertyOptional({ example: 12000, nullable: true, description: 'Prix d\'achat FCFA' })
  priceBuy: number | null;

  @ApiProperty({ example: 15000, description: 'Prix de vente FCFA' })
  priceSell: number;

  @ApiProperty({ example: false })
  isArchived: boolean;

  @ApiProperty({ example: false, description: 'true si quantityInStock <= alertThreshold' })
  isLowStock: boolean;
}

export class CreateProductResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'Riz parfumé 25kg' })
  name: string;

  @ApiProperty({ example: 1 })
  categoryId: number | null;

  @ApiProperty({ example: 50 })
  quantityInStock: number;

  @ApiProperty({ example: 5 })
  alertThreshold: number;

  @ApiProperty({ example: 15000 })
  priceSell: number;

  @ApiPropertyOptional({ example: 12000, nullable: true })
  priceBuy: number | null;
}

export class UpdateProductResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'Riz parfumé 25kg premium' })
  name: string;

  @ApiProperty({ example: 1 })
  categoryId: number | null;

  @ApiProperty({ example: 16000 })
  priceSell: number;

  @ApiPropertyOptional({ example: 12500, nullable: true })
  priceBuy: number | null;

  @ApiProperty({ example: 8 })
  alertThreshold: number;
}

export class ArchiveProductResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: true })
  archived: boolean;
}

export class DeleteProductResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: true })
  deleted: boolean;
}

export class StockAdjustmentMovementDto {
  @ApiProperty({ example: 45 })
  id: number;

  @ApiProperty({ example: 'restock' })
  type: string;

  @ApiProperty({ example: 10 })
  quantityChange: number;

  @ApiProperty({ example: 38 })
  quantityBefore: number;

  @ApiProperty({ example: 48 })
  quantityAfter: number;

  @ApiProperty({ example: 1719225600000 })
  createdAt: number;
}

export class StockAdjustmentResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 48 })
  quantityInStock: number;

  @ApiPropertyOptional({ example: true, description: 'Présent si quantityChange = 0' })
  unchanged?: boolean;

  @ApiPropertyOptional({ type: StockAdjustmentMovementDto })
  movement?: StockAdjustmentMovementDto;
}

export class StockMovementResponseDto {
  @ApiProperty({ example: 45 })
  id: number;

  @ApiProperty({
    enum: ['sale', 'restock', 'adjustment', 'loss', 'return', 'initial', 'sale_cancel'],
    example: 'restock',
  })
  type: string;

  @ApiProperty({ example: 10 })
  quantityChange: number;

  @ApiProperty({ example: 38 })
  quantityBefore: number;

  @ApiProperty({ example: 48 })
  quantityAfter: number;

  @ApiPropertyOptional({ example: 'Réapprovisionnement fournisseur', nullable: true })
  reason: string | null;

  @ApiProperty({ example: 1, description: 'Utilisateur ayant effectué le mouvement' })
  userId: number;

  @ApiProperty({ example: 1719225600000 })
  createdAt: number;
}
