import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { SettingsRepository } from '../../domain/repositories/settings.repository';
import { ShopRepository } from '../../domain/repositories/shop.repository';
import { ShopOwnershipService } from '../../domain/services/shop-ownership.service';
import { LastActiveShopException, ShopInactiveException } from '../../exceptions/shop.exceptions';
import { CreateShopDto, UpdateShopDto } from '../dto/shop-management.dto';
import { Shop } from '../../domain/entities/shop.entity';

@Injectable()
export class ListOwnedShopsUseCase {
  constructor(private readonly shops: ShopRepository) {}

  async execute(auth: AuthContext) {
    if (auth.role !== UserRole.OWNER) {
      throw new ForbiddenException('Réservé au patron.');
    }

    const rows = await this.shops.findByOwnerUserId(auth.userId);
    return {
      activeShopId: auth.shopId,
      shops: rows.map((shop) => this.toItem(shop, auth.shopId)),
    };
  }

  private toItem(shop: Shop, activeShopId: number) {
    return {
      id: shop.id,
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      isActive: shop.isActive,
      isDefault: shop.isDefault,
      isCurrent: shop.id === activeShopId,
    };
  }
}

@Injectable()
export class GetOwnedShopUseCase {
  constructor(
    private readonly shops: ShopRepository,
    private readonly ownership: ShopOwnershipService,
  ) {}

  async execute(auth: AuthContext, shopId: number) {
    const shop = await this.ownership.assertOwnerAccess(auth.userId, auth.role, shopId);
    return {
      id: shop.id,
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      isActive: shop.isActive,
      isDefault: shop.isDefault,
      createdAt: shop.createdAt,
    };
  }
}

@Injectable()
export class CreateShopUseCase {
  constructor(
    private readonly shops: ShopRepository,
    private readonly settings: SettingsRepository,
    private readonly ownership: ShopOwnershipService,
    private readonly logAudit: LogAuditUseCase,
    private readonly configService: ConfigService,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async execute(auth: AuthContext, dto: CreateShopDto) {
    await this.ownership.assertOwnerAccess(auth.userId, auth.role, auth.shopId);

    const timestamp = nowMs();
    const shop = await this.shops.create({
      name: dto.name.trim(),
      address: dto.address?.trim() || null,
      phone: dto.phone?.trim() || null,
      owner_user_id: auth.userId,
      is_active: true,
      is_default: false,
      created_at: timestamp,
    });

    await this.tenantDb.runWithTenant(shop.id, () =>
      this.settings.create({
        shop_id: shop.id,
        shop_name: shop.name,
        shop_phone: shop.phone,
        shop_address: shop.address,
        auto_lock_minutes: this.configService.get<number>('auth.defaultAutoLockMinutes', 5),
        updated_at: timestamp,
      }),
    );

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SHOP_CREATED,
      module: AuditModule.SHOPS,
      entityId: shop.id,
      entityTable: 'shops',
      newValue: { id: shop.id, name: shop.name },
      reason: 'Création boutique (UC-20)',
    });

    return {
      id: shop.id,
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      isActive: shop.isActive,
      isDefault: shop.isDefault,
      createdAt: shop.createdAt,
    };
  }
}

@Injectable()
export class UpdateShopUseCase {
  constructor(
    private readonly shops: ShopRepository,
    private readonly settings: SettingsRepository,
    private readonly ownership: ShopOwnershipService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, shopId: number, dto: UpdateShopDto) {
    const existing = await this.ownership.assertOwnerAccess(auth.userId, auth.role, shopId);
    const timestamp = nowMs();

    const updated = await this.shops.updateInShop(shopId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
    });

    if (dto.name !== undefined || dto.address !== undefined || dto.phone !== undefined) {
      await this.settings.updateShopIdentity(shopId, {
        ...(dto.name !== undefined ? { shop_name: updated.name } : {}),
        ...(dto.address !== undefined ? { shop_address: updated.address } : {}),
        ...(dto.phone !== undefined ? { shop_phone: updated.phone } : {}),
        updated_at: timestamp,
      });
    }

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SHOP_UPDATED,
      module: AuditModule.SHOPS,
      entityId: shopId,
      entityTable: 'shops',
      oldValue: { name: existing.name, address: existing.address, phone: existing.phone },
      newValue: { name: updated.name, address: updated.address, phone: updated.phone },
    });

    return {
      id: updated.id,
      name: updated.name,
      address: updated.address,
      phone: updated.phone,
      isActive: updated.isActive,
      isDefault: updated.isDefault,
      createdAt: updated.createdAt,
    };
  }
}

@Injectable()
export class DeactivateShopUseCase {
  constructor(
    private readonly shops: ShopRepository,
    private readonly ownership: ShopOwnershipService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, shopId: number, reason?: string) {
    const existing = await this.ownership.assertOwnerAccess(auth.userId, auth.role, shopId);

    if (!existing.isActive) {
      return { id: shopId, isActive: false };
    }

    const activeCount = await this.shops.countActiveByOwner(auth.userId);
    if (activeCount <= 1) {
      throw new LastActiveShopException();
    }

    const updated = await this.shops.updateInShop(shopId, { is_active: false });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SHOP_DEACTIVATED,
      module: AuditModule.SHOPS,
      entityId: shopId,
      entityTable: 'shops',
      oldValue: { is_active: true },
      newValue: { is_active: false },
      reason: reason ?? 'Désactivation boutique (RG-SHOP-08)',
    });

    return { id: updated.id, isActive: updated.isActive };
  }
}

@Injectable()
export class SetDefaultShopUseCase {
  constructor(
    private readonly shops: ShopRepository,
    private readonly ownership: ShopOwnershipService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, shopId: number) {
    const shop = await this.ownership.assertOwnerAccess(auth.userId, auth.role, shopId);
    if (!shop.isActive) {
      throw new ShopInactiveException();
    }

    await this.shops.clearDefaultForOwner(auth.userId);
    await this.shops.updateInShop(shopId, { is_default: true });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SHOP_DEFAULT_SET,
      module: AuditModule.SHOPS,
      entityId: shopId,
      entityTable: 'shops',
      newValue: { is_default: true },
    });

    return { id: shopId, isDefault: true as const };
  }
}
