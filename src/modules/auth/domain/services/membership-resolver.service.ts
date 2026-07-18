import { Injectable } from '@nestjs/common';
import { PermissionService } from '../../../../core/security/permission.service';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { ShopHierarchyService } from '../../../shops/domain/services/shop-hierarchy.service';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { IdentityRepository } from '../../../identity/domain/repositories/identity.repository';

export type MembershipScopeType = 'shop' | 'organization';

export interface ShopMembershipDto {
  userId: number;
  shopId: number;
  shopName: string;
  role: string;
  roleLabel: string;
  isDefault: boolean;
  scopeType: MembershipScopeType;
  organizationName?: string;
  shopCount?: number;
  accessibleShopIds?: number[];
  organizationId?: number;
  membershipId?: number;
  identityId?: number | null;
}

@Injectable()
export class MembershipResolverService {
  constructor(
    private readonly users: UserRepository,
    private readonly shops: ShopRepository,
    private readonly permissionService: PermissionService,
    private readonly tenantDb: TenantDatabaseService,
    private readonly hierarchy: ShopHierarchyService,
    private readonly identity: IdentityRepository,
  ) {}

  async resolveByPhone(phone: string): Promise<ShopMembershipDto[]> {
    return this.tenantDb.runWithoutTenant(async () => {
      const persisted = await this.resolveFromIdentityTables(phone);
      if (persisted.length > 0) {
        return persisted;
      }
      return this.resolveLegacyByPhone(phone);
    });
  }

  matchesSelection(
    membership: ShopMembershipDto,
    userId: number,
    shopId: number,
  ): boolean {
    if (membership.userId !== userId) return false;
    if (membership.shopId === shopId) return true;
    if (
      membership.scopeType === 'organization' &&
      membership.accessibleShopIds?.includes(shopId)
    ) {
      return true;
    }
    return false;
  }

  findMatchingMembership(
    memberships: ShopMembershipDto[],
    userId: number,
    shopId: number,
  ): ShopMembershipDto | undefined {
    return memberships.find((membership) =>
      this.matchesSelection(membership, userId, shopId),
    );
  }

  private async resolveFromIdentityTables(phone: string): Promise<ShopMembershipDto[]> {
    const rows = await this.identity.findMembershipsByPhone(phone);
    const memberships: ShopMembershipDto[] = [];

    for (const row of rows) {
      const roleLabel = await this.permissionService.getRoleLabel(row.role);
      const shopCount = row.accessibleShopIds.length;
      const scopeType: MembershipScopeType =
        row.role === UserRole.OWNER && shopCount > 1 ? 'organization' : 'shop';

      memberships.push({
        userId: row.userId,
        shopId: row.entryShopId,
        shopName: scopeType === 'organization' ? row.organizationName : row.entryShopName,
        role: row.role,
        roleLabel,
        isDefault: row.isDefault,
        scopeType,
        organizationName: row.organizationName,
        shopCount,
        accessibleShopIds: row.accessibleShopIds,
        organizationId: row.organizationId,
        membershipId: row.membershipId,
        identityId: row.identityId,
      });
    }

    return memberships;
  }

  private async resolveLegacyByPhone(phone: string): Promise<ShopMembershipDto[]> {
    const matches = await this.users.findActiveByPhone(phone);
    const memberships: ShopMembershipDto[] = [];
    const seen = new Set<string>();

    for (const user of matches) {
      if (user.role === UserRole.OWNER) {
        await this.appendOwnerMemberships(user.id, user.role, memberships, seen);
        continue;
      }

      const shop = await this.shops.findShopById(user.shopId);
      if (!shop?.isActive) continue;
      const key = `${user.id}:shop:${user.shopId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      memberships.push({
        userId: user.id,
        shopId: user.shopId,
        shopName: shop.name,
        role: user.role,
        roleLabel: await this.permissionService.getRoleLabel(user.role),
        isDefault: shop.isDefault,
        scopeType: 'shop',
        shopCount: 1,
        accessibleShopIds: [user.shopId],
      });
    }

    memberships.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.shopName.localeCompare(b.shopName);
    });

    return memberships;
  }

  private async appendOwnerMemberships(
    userId: number,
    role: string,
    memberships: ShopMembershipDto[],
    seen: Set<string>,
  ): Promise<void> {
    const owned = await this.shops.findByOwnerUserId(userId);
    const activeOwned = owned.filter((shop) => shop.isActive);
    if (activeOwned.length === 0) return;

    const groups = new Map<number, typeof activeOwned>();
    for (const shop of activeOwned) {
      const rootId = this.hierarchy.resolveRootShopId(activeOwned, shop.id);
      const group = groups.get(rootId) ?? [];
      group.push(shop);
      groups.set(rootId, group);
    }

    const roleLabel = await this.permissionService.getRoleLabel(role);

    for (const [rootId, groupShops] of groups) {
      const key = `${userId}:org:${rootId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const entryShop = this.pickEntryShop(groupShops, rootId);
      const organizationName =
        groupShops.find((shop) => shop.id === rootId)?.name ?? entryShop.name;
      const shopIds = groupShops.map((shop) => shop.id).sort((a, b) => a - b);

      if (groupShops.length === 1) {
        memberships.push({
          userId,
          shopId: entryShop.id,
          shopName: entryShop.name,
          role,
          roleLabel,
          isDefault: entryShop.isDefault,
          scopeType: 'shop',
          shopCount: 1,
          accessibleShopIds: shopIds,
        });
        continue;
      }

      memberships.push({
        userId,
        shopId: entryShop.id,
        shopName: organizationName,
        role,
        roleLabel,
        isDefault: groupShops.some((shop) => shop.isDefault),
        scopeType: 'organization',
        organizationName,
        shopCount: groupShops.length,
        accessibleShopIds: shopIds,
      });
    }
  }

  private pickEntryShop<T extends { id: number; name: string; isDefault: boolean }>(
    groupShops: T[],
    rootId: number,
  ): T {
    const defaultShop = groupShops.find((shop) => shop.isDefault);
    if (defaultShop) return defaultShop;

    const rootShop = groupShops.find((shop) => shop.id === rootId);
    if (rootShop) return rootShop;

    return [...groupShops].sort((a, b) => a.name.localeCompare(b.name))[0];
  }
}
