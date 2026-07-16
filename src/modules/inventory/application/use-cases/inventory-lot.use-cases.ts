import { Injectable } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { InventoryLotMapper } from '../../infrastructure/mappers/inventory-lot.mapper';
import { InventoryLotService } from '../../domain/services/inventory-lot.service';

export class InventoryLotResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() shopId!: number;
  @ApiProperty() productId!: number;
  @ApiProperty() sourceType!: string;
  @ApiPropertyOptional() sourceId?: number | null;
  @ApiPropertyOptional() purchaseReceiptItemId?: number | null;
  @ApiPropertyOptional() supplierId?: number | null;
  @ApiProperty() unitCost!: number;
  @ApiProperty() quantityReceived!: number;
  @ApiProperty() quantityRemaining!: number;
  @ApiPropertyOptional() batchNumber?: string | null;
  @ApiPropertyOptional() expiryDate?: number | null;
  @ApiProperty() receivedAt!: number;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: number;
  @ApiProperty() version!: number;
}

export class ListInventoryLotsQueryDto {
  @ApiPropertyOptional({ description: 'Filtrer par produit local serveur' })
  productId?: number;
}

@Injectable()
export class ListInventoryLotsUseCase {
  constructor(private readonly lots: InventoryLotService) {}

  async execute(auth: AuthContext, productId?: number) {
    const rows = await this.lots.listByShop(auth.shopId, productId);
    return rows.map((lot) => InventoryLotMapper.toDto(lot));
  }
}

@Injectable()
export class ListProductInventoryLotsUseCase {
  constructor(private readonly lots: InventoryLotService) {}

  async execute(auth: AuthContext, productId: number) {
    const rows = await this.lots.listByShop(auth.shopId, productId);
    return rows
      .filter((lot) => lot.quantityRemaining > 0)
      .map((lot) => InventoryLotMapper.toDto(lot));
  }
}
