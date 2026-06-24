import { Injectable, Logger } from '@nestjs/common';
import { AppCacheService } from '../../../../core/cache/app-cache.service';
import { ROLE_PERMISSIONS } from '../../../../shared/constants/role-permissions.map';
import { Permission } from '../../../../shared/enums/permission.enum';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { RbacRepository } from '../repositories/rbac.repository';
import { PermissionEffect } from '../entities/rbac.entity';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_PREFIX = 'rbac:perms:';

export interface ResolvePermissionsInput {
  userId: number;
  role: UserRole;
  shopId: number;
}

@Injectable()
export class EffectivePermissionResolver {
  private readonly logger = new Logger(EffectivePermissionResolver.name);

  constructor(
    private readonly rbac: RbacRepository,
    private readonly cache: AppCacheService,
  ) {}

  async resolve(input: ResolvePermissionsInput): Promise<Permission[]> {
    const cacheKey = `${CACHE_PREFIX}${input.shopId}:${input.userId}:${input.role}`;
    const cached = this.cache.get<Permission[]>(cacheKey);
    if (cached) return cached;

    try {
      const resolved = await this.resolveFromDatabase(input);
      this.cache.set(cacheKey, resolved, CACHE_TTL_MS);
      return resolved;
    } catch (error) {
      this.logger.warn(
        `RBAC DB indisponible, fallback statique pour ${input.role}: ${(error as Error).message}`,
      );
      const fallback = this.resolveFromStaticMap(input.role);
      this.cache.set(cacheKey, fallback, 60_000);
      return fallback;
    }
  }

  invalidateUser(userId: number, shopId: number): void {
    this.cache.invalidatePrefix(`${CACHE_PREFIX}${shopId}:${userId}:`);
  }

  invalidateRole(role: string): void {
    this.cache.invalidatePrefix(CACHE_PREFIX);
    void role;
  }

  private async resolveFromDatabase(input: ResolvePermissionsInput): Promise<Permission[]> {
    const roleChain = await this.collectRoleChain(input.role);
    const grants = new Map<string, PermissionEffect>();

    for (const roleCode of roleChain) {
      const roleGrants = await this.rbac.findDirectRolePermissions(roleCode);
      for (const grant of roleGrants) {
        if (grant.effect === 'allow') {
          grants.set(grant.permissionCode, 'allow');
        } else {
          grants.delete(grant.permissionCode);
        }
      }
    }

    const overrides = await this.rbac.findActiveUserOverrides(input.userId, input.shopId);
    const now = Date.now();
    for (const override of overrides) {
      if (override.expiresAt && override.expiresAt <= now) continue;
      if (override.effect === 'grant') {
        grants.set(override.permissionCode, 'allow');
      } else {
        grants.delete(override.permissionCode);
      }
    }

    return this.toPermissionEnum([...grants.keys()]);
  }

  private async collectRoleChain(roleCode: string): Promise<string[]> {
    const visited = new Set<string>();
    const queue = [roleCode];
    const chain: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      chain.push(current);
      const parents = await this.rbac.findParentRoleCodes(current);
      queue.push(...parents);
    }

    return chain.reverse();
  }

  private resolveFromStaticMap(role: UserRole): Permission[] {
    return [...ROLE_PERMISSIONS[role]];
  }

  private toPermissionEnum(codes: string[]): Permission[] {
    const valid = new Set(Object.values(Permission));
    return codes.filter((c): c is Permission => valid.has(c as Permission));
  }
}
