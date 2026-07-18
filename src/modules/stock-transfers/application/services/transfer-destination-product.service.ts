import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nowMs } from '../../../../shared/utils/time.util';
import { ProductRepository } from '../../../inventory/domain/repositories/product.repository';
import { CategoryRepository } from '../../../inventory/domain/repositories/category.repository';
import { ProductValidationService } from '../../../inventory/domain/services/product-validation.service';
import {
  StockTransfer,
  StockTransferItem,
} from '../../domain/entities/stock-transfer.entity';
import { StockTransferRepository } from '../../domain/repositories/stock-transfer.repository';
import { ReceiveTransferProductSetupDto } from '../dto/stock-transfer.dto';

@Injectable()
export class TransferDestinationProductService {
  static readonly importCategoryName = 'Transferts inter-boutiques';

  constructor(
    private readonly repo: StockTransferRepository,
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly validation: ProductValidationService,
    private readonly configService: ConfigService,
  ) {}

  async ensureDestinationProduct(
    destinationShopId: number,
    transfer: StockTransfer,
    item: StockTransferItem,
    setup?: ReceiveTransferProductSetupDto,
  ): Promise<number | null> {
    const existing = await this.resolveDestinationProductId(
      destinationShopId,
      transfer,
      item,
      setup,
    );
    if (existing != null) return existing;

    if (setup) {
      return this.createDestinationProduct(destinationShopId, setup);
    }

    const sourceProduct = await this.products.findByIdAndShop(
      item.sourceProductId,
      transfer.sourceShopId,
    );
    const name =
      item.productName?.trim() || sourceProduct?.name?.trim() || null;
    if (!name) return null;

    const unitCost =
      item.lotLines.length > 0 ? item.lotLines[0].unitCost : null;
    const priceSell = Math.max(
      1,
      sourceProduct?.priceSell ?? unitCost ?? 1,
    );

    return this.createDestinationProduct(destinationShopId, {
      name,
      priceSell,
      priceBuy: sourceProduct?.priceBuy ?? unitCost ?? undefined,
      productServerId: item.productServerId ?? undefined,
    });
  }

  private async resolveDestinationProductId(
    destinationShopId: number,
    transfer: StockTransfer,
    item: StockTransferItem,
    setup?: ReceiveTransferProductSetupDto,
  ): Promise<number | null> {
    if (item.destinationProductId != null) {
      const linked = await this.products.findByIdAndShop(
        item.destinationProductId,
        destinationShopId,
      );
      if (linked) return linked.id;
    }

    const serverIdCandidates = [
      item.productServerId,
      setup?.productServerId,
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);

    for (const serverId of serverIdCandidates) {
      const byServerId = await this.products.findIdByServerIdInShop(
        destinationShopId,
        serverId,
      );
      if (byServerId != null) return byServerId;

      const byTransferRepo = await this.repo.findProductIdByServerId(
        destinationShopId,
        serverId,
      );
      if (byTransferRepo != null) return byTransferRepo;
    }

    const sourceProduct = await this.products.findByIdAndShop(
      item.sourceProductId,
      transfer.sourceShopId,
    );
    const sourceServerId = sourceProduct?.serverId?.trim();
    if (sourceServerId) {
      const bySourceServerId = await this.products.findIdByServerIdInShop(
        destinationShopId,
        sourceServerId,
      );
      if (bySourceServerId != null) return bySourceServerId;
    }

    const name =
      setup?.name?.trim() ||
      item.productName?.trim() ||
      sourceProduct?.name?.trim() ||
      null;
    if (name) {
      return this.products.findIdByNameInShop(destinationShopId, name);
    }

    return null;
  }

  private async createDestinationProduct(
    destinationShopId: number,
    setup: ReceiveTransferProductSetupDto,
  ): Promise<number> {
    this.validation.validateName(setup.name);
    this.validation.validatePrices({
      priceSell: setup.priceSell,
      priceBuy: setup.priceBuy,
    });

    const categoryId = await this.resolveImportCategoryId(destinationShopId);
    const defaultThreshold = this.configService.get<number>(
      'dashboard.defaultAlertThreshold',
      5,
    );
    const timestamp = nowMs();

    const product = await this.products.create({
      shop_id: destinationShopId,
      category_id: categoryId,
      name: setup.name.trim(),
      quantity_in_stock: 0,
      alert_threshold: defaultThreshold,
      price_buy: setup.priceBuy ?? null,
      price_sell: setup.priceSell,
      created_at: timestamp,
      updated_at: timestamp,
    });

    return product.id;
  }

  private async resolveImportCategoryId(shopId: number): Promise<number> {
    const categories = await this.categories.findAllByShop(shopId, true);
    const existing = categories.find(
      (category) =>
        category.name === TransferDestinationProductService.importCategoryName,
    );
    if (existing) return existing.id;
    if (categories.length > 0) return categories[0].id;

    const timestamp = nowMs();
    const created = await this.categories.create({
      shop_id: shopId,
      name: TransferDestinationProductService.importCategoryName,
      description: 'Produits créés lors d\'un transfert inter-boutiques',
      sort_order: 999,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return created.id;
  }
}
