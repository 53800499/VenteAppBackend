import { Injectable } from '@nestjs/common';
import { PermissionService } from '../../../../core/security/permission.service';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { UserRepository } from '../../../users/domain/repositories/user.repository';

export interface ShopMembershipDto {
  userId: number;
  shopId: number;
  shopName: string;
  role: UserRole;
  roleLabel: string;
  isDefault: boolean;
}

@Injectable()
export class MembershipResolverService {
  constructor(
    private readonly users: UserRepository,
    private readonly shops: ShopRepository,
    private readonly permissionService: PermissionService,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async resolveByPhone(phone: string): Promise<ShopMembershipDto[]> {
    return this.tenantDb.runWithoutTenant(async () => {
      const matches = await this.users.findActiveByPhone(phone);
      const memberships: ShopMembershipDto[] = [];
      const seen = new Set<string>();

      for (const user of matches) {
        if (user.role === UserRole.OWNER) {
          const owned = await this.shops.findByOwnerUserId(user.id);
          for (const shop of owned) {
            if (!shop.isActive) continue;
            const key = `${user.id}:${shop.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            memberships.push({
              userId: user.id,
              shopId: shop.id,
              shopName: shop.name,
              role: user.role,
              roleLabel: await this.permissionService.getRoleLabel(user.role),
              isDefault: shop.isDefault,
            });
          }
          continue;
        }

        const shop = await this.shops.findShopById(user.shopId);
        if (!shop?.isActive) continue;
        const key = `${user.id}:${user.shopId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        memberships.push({
          userId: user.id,
          shopId: user.shopId,
          shopName: shop.name,
          role: user.role,
          roleLabel: await this.permissionService.getRoleLabel(user.role),
          isDefault: shop.isDefault,
        });
      }

      memberships.sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.shopName.localeCompare(b.shopName);
      });

      return memberships;
    });
  }
}
