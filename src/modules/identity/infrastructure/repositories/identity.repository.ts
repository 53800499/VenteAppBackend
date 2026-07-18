import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import {
  IdentityContext,
  MembershipWithAccess,
  ShopAccessEntry,
  ShopAccessGrant,
  UserShopAccessView,
} from '../../domain/entities/identity.entity';
import { IdentityRepository } from '../../domain/repositories/identity.repository';

type ShopAccessRow = {
  shop_id: number;
  access_role: string | null;
  shops: {
    id: number;
    name: string;
    is_default: boolean;
    is_active: boolean;
  } | null;
};

type MembershipQueryRow = {
  id: number;
  user_id: number;
  identity_id: number | null;
  role: string;
  organization_id: number;
  organizations: {
    id: number;
    name: string;
    root_shop_id: number;
  } | null;
  shop_access: ShopAccessRow[] | null;
};

@Injectable()
export class SupabaseIdentityRepository extends IdentityRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findMembershipsByPhone(phone: string): Promise<MembershipWithAccess[]> {
    const identityId = await this.findIdentityIdByPhone(phone);
    if (identityId != null) {
      const byIdentity = await this.loadMembershipRows({ identityId });
      if (byIdentity.length > 0) {
        return this.mapMembershipRows(byIdentity);
      }
    }

    const { data: users, error: usersError } = await this.supabase.db
      .from('users')
      .select('id')
      .eq('phone', phone)
      .eq('is_active', true);

    if (usersError) throw new BadRequestException(usersError.message);
    const userIds = (users ?? []).map((row) => row.id as number);
    if (userIds.length === 0) return [];

    return this.mapMembershipRows(await this.loadMembershipRows({ userIds }));
  }

  async findIdentityContext(
    userId: number,
    activeShopId: number,
  ): Promise<IdentityContext | null> {
    const rows = await this.loadMembershipRows({ userId });
    if (rows.length === 0) return null;

    const membership =
      rows.find((row) =>
        (row.shop_access ?? []).some((access) => access.shop_id === activeShopId),
      ) ?? rows[0];

    const organization = membership.organizations;
    if (!organization) return null;

    const accessibleShops = await this.buildAccessibleShopViews(
      membership,
      activeShopId,
    );
    const activeShop =
      accessibleShops.find((shop) => shop.id === activeShopId) ?? accessibleShops[0];
    if (!activeShop) return null;

    const effectiveRole = activeShop.accessRole ?? membership.role;
    const [roleLabel, effectiveRoleLabel] = await Promise.all([
      this.resolveRoleLabel(membership.role),
      this.resolveRoleLabel(effectiveRole),
    ]);

    return {
      membershipId: membership.id,
      identityId: membership.identity_id,
      organizationId: organization.id,
      organizationName: organization.name,
      role: membership.role,
      roleLabel,
      effectiveRole,
      effectiveRoleLabel,
      activeShopId: activeShop.id,
      activeShopName: activeShop.name,
      accessibleShops,
    };
  }

  async userHasShopAccess(userId: number, shopId: number): Promise<boolean> {
    const { data, error } = await this.supabase.db.rpc('user_has_shop_access', {
      p_user_id: userId,
      p_shop_id: shopId,
    });

    if (error?.code === 'PGRST202') {
      return this.userHasShopAccessFallback(userId, shopId);
    }
    if (error) throw new BadRequestException(error.message);
    return Boolean(data);
  }

  async resolveEffectiveRole(userId: number, shopId: number): Promise<string | null> {
    const { data, error } = await this.supabase.db.rpc('resolve_effective_role', {
      p_user_id: userId,
      p_shop_id: shopId,
    });

    if (error?.code === 'PGRST202') {
      return this.resolveEffectiveRoleFallback(userId, shopId);
    }
    if (error) throw new BadRequestException(error.message);
    return (data as string | null) ?? null;
  }

  async ensureIdentity(phone: string, displayName?: string): Promise<number> {
    const timestamp = nowMs();
    const { data: existing, error: existingError } = await this.supabase.db
      .from('identities')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (existingError) throw new BadRequestException(existingError.message);
    if (existing) {
      if (displayName?.trim()) {
        await this.supabase.db
          .from('identities')
          .update({ display_name: displayName.trim(), updated_at: timestamp })
          .eq('id', existing.id);
      }
      return existing.id as number;
    }

    const { data, error } = await this.supabase.db
      .from('identities')
      .insert({
        phone,
        display_name: displayName?.trim() ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('id')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data.id as number;
  }

  async linkUserIdentity(userId: number, identityId: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('users')
      .update({ identity_id: identityId })
      .eq('id', userId);

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db
      .from('memberships')
      .update({ identity_id: identityId })
      .eq('user_id', userId);
  }

  async ensureOwnerOrganization(
    _userId: number,
    rootShopId: number,
    organizationName: string,
  ): Promise<number> {
    const timestamp = nowMs();
    const { data: existing, error: existingError } = await this.supabase.db
      .from('organizations')
      .select('id')
      .eq('root_shop_id', rootShopId)
      .maybeSingle();

    if (existingError) throw new BadRequestException(existingError.message);
    if (existing) return existing.id as number;

    const { data, error } = await this.supabase.db
      .from('organizations')
      .insert({
        root_shop_id: rootShopId,
        name: organizationName,
        created_at: timestamp,
      })
      .select('id')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data.id as number;
  }

  async ensureMembership(
    organizationId: number,
    userId: number,
    role: string,
    identityId: number | null = null,
    isPrimary = true,
  ): Promise<number> {
    const timestamp = nowMs();
    const { data: existing, error: existingError } = await this.supabase.db
      .from('memberships')
      .select('id, identity_id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) throw new BadRequestException(existingError.message);
    if (existing) {
      if (identityId != null && existing.identity_id == null) {
        await this.supabase.db
          .from('memberships')
          .update({ identity_id: identityId })
          .eq('id', existing.id);
      }
      return existing.id as number;
    }

    const { data, error } = await this.supabase.db
      .from('memberships')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        identity_id: identityId,
        role,
        is_primary: isPrimary,
        created_at: timestamp,
      })
      .select('id')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data.id as number;
  }

  async grantShopAccess(
    membershipId: number,
    shopId: number,
    accessRole: string | null = null,
  ): Promise<void> {
    const { data: existing, error: existingError } = await this.supabase.db
      .from('shop_access')
      .select('membership_id, access_role')
      .eq('membership_id', membershipId)
      .eq('shop_id', shopId)
      .maybeSingle();

    if (existingError) throw new BadRequestException(existingError.message);
    if (existing) {
      if (accessRole !== undefined) {
        await this.supabase.db
          .from('shop_access')
          .update({ access_role: accessRole })
          .eq('membership_id', membershipId)
          .eq('shop_id', shopId);
      }
      return;
    }

    const { error } = await this.supabase.db.from('shop_access').insert({
      membership_id: membershipId,
      shop_id: shopId,
      access_role: accessRole,
      created_at: nowMs(),
    });

    if (error) throw new BadRequestException(error.message);
  }

  async syncOwnerShopAccess(
    userId: number,
    organizationId: number,
    shopIds: number[],
  ): Promise<void> {
    const membershipId = await this.findMembershipForUserInOrganization(
      userId,
      organizationId,
    );
    if (membershipId == null) return;

    for (const shopId of shopIds) {
      await this.grantShopAccess(membershipId, shopId, null);
    }
  }

  async syncStaffShopAccess(
    userId: number,
    organizationId: number,
    shopId: number,
    role: string,
    identityId: number | null = null,
    accessRole: string | null = null,
  ): Promise<void> {
    const membershipId = await this.ensureMembership(
      organizationId,
      userId,
      role,
      identityId,
    );
    await this.grantShopAccess(membershipId, shopId, accessRole);
  }

  async replaceMembershipShopAccess(
    membershipId: number,
    grants: ShopAccessGrant[],
  ): Promise<void> {
    await this.supabase.db
      .from('shop_access')
      .delete()
      .eq('membership_id', membershipId);

    for (const grant of grants) {
      await this.grantShopAccess(membershipId, grant.shopId, grant.accessRole ?? null);
    }
  }

  async findMembershipForUserInOrganization(
    userId: number,
    organizationId: number,
  ): Promise<number | null> {
    const { data, error } = await this.supabase.db
      .from('memberships')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data?.id != null ? (data.id as number) : null;
  }

  async findUserShopAccess(
    userId: number,
    rootShopId: number,
  ): Promise<UserShopAccessView | null> {
    const rows = await this.loadMembershipRows({ userId });
    const membership = rows.find(
      (row) => row.organizations?.root_shop_id === rootShopId,
    );
    if (!membership?.organizations) return null;

    const entries = this.extractShopAccess(membership.shop_access);
    const grants = await Promise.all(
      entries.map(async (entry) => {
        const effectiveRole = entry.accessRole ?? membership.role;
        return {
          shopId: entry.shopId,
          shopName: entry.shopName,
          accessRole: entry.accessRole,
          effectiveRole,
          effectiveRoleLabel: await this.resolveRoleLabel(effectiveRole),
        };
      }),
    );

    return {
      membershipId: membership.id,
      userId,
      role: membership.role,
      roleLabel: await this.resolveRoleLabel(membership.role),
      grants: grants.sort((a, b) => a.shopName.localeCompare(b.shopName)),
    };
  }

  private async findIdentityIdByPhone(phone: string): Promise<number | null> {
    const { data, error } = await this.supabase.db
      .from('identities')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data?.id != null ? (data.id as number) : null;
  }

  private async loadMembershipRows(filter: {
    identityId?: number;
    userIds?: number[];
    userId?: number;
  }): Promise<MembershipQueryRow[]> {
    let query = this.supabase.db.from('memberships').select(
      `
        id,
        user_id,
        identity_id,
        role,
        organization_id,
        organizations (
          id,
          name,
          root_shop_id
        ),
        shop_access (
          shop_id,
          access_role,
          shops (
            id,
            name,
            is_default,
            is_active
          )
        )
      `,
    );

    if (filter.identityId != null) {
      query = query.eq('identity_id', filter.identityId);
    } else if (filter.userId != null) {
      query = query.eq('user_id', filter.userId);
    } else if (filter.userIds != null) {
      query = query.in('user_id', filter.userIds);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as unknown as MembershipQueryRow[];
  }

  private async mapMembershipRows(
    rows: MembershipQueryRow[],
  ): Promise<MembershipWithAccess[]> {
    const memberships = rows
      .map((row) => this.toMembershipWithAccess(row))
      .filter((membership): membership is MembershipWithAccess => membership != null);

    memberships.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.organizationName.localeCompare(b.organizationName);
    });

    return memberships;
  }

  private toMembershipWithAccess(row: MembershipQueryRow): MembershipWithAccess | null {
    const organization = row.organizations;
    if (!organization) return null;

    const shopAccess = this.extractShopAccess(row.shop_access);
    if (shopAccess.length === 0) return null;

    const accessibleShopIds = shopAccess.map((entry) => entry.shopId).sort((a, b) => a - b);
    const entryShop =
      shopAccess.find((entry) => entry.isDefault) ??
      shopAccess.find((entry) => entry.shopId === organization.root_shop_id) ??
      shopAccess[0];

    return {
      membershipId: row.id,
      userId: row.user_id,
      identityId: row.identity_id,
      role: row.role,
      organizationId: organization.id,
      organizationName: organization.name,
      rootShopId: organization.root_shop_id,
      entryShopId: entryShop.shopId,
      entryShopName: entryShop.shopName,
      isDefault: shopAccess.some((entry) => entry.isDefault),
      accessibleShopIds,
      shopAccess,
    };
  }

  private extractShopAccess(rows: ShopAccessRow[] | null): ShopAccessEntry[] {
    const entries: ShopAccessEntry[] = [];
    for (const access of rows ?? []) {
      const shop = access.shops;
      if (shop == null || !shop.is_active) continue;
      entries.push({
        shopId: shop.id,
        shopName: shop.name,
        isDefault: shop.is_default,
        isActive: shop.is_active,
        accessRole: access.access_role,
      });
    }
    return entries;
  }

  private async buildAccessibleShopViews(
    membership: MembershipQueryRow,
    activeShopId: number,
  ) {
    const entries = this.extractShopAccess(membership.shop_access);
    const views = await Promise.all(
      entries.map(async (entry) => {
        const effectiveRole = entry.accessRole ?? membership.role;
        return {
          id: entry.shopId,
          name: entry.shopName,
          isCurrent: entry.shopId === activeShopId,
          isDefault: entry.isDefault,
          accessRole: entry.accessRole,
          roleLabel: await this.resolveRoleLabel(effectiveRole),
        };
      }),
    );

    return views.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async userHasShopAccessFallback(userId: number, shopId: number): Promise<boolean> {
    const { data, error } = await this.supabase.db
      .from('shop_access')
      .select('shop_id, memberships!inner(user_id)')
      .eq('shop_id', shopId)
      .eq('memberships.user_id', userId)
      .limit(1);

    if (error) throw new BadRequestException(error.message);
    return (data?.length ?? 0) > 0;
  }

  private async resolveEffectiveRoleFallback(
    userId: number,
    shopId: number,
  ): Promise<string | null> {
    const { data, error } = await this.supabase.db
      .from('shop_access')
      .select('access_role, memberships!inner(user_id, role)')
      .eq('shop_id', shopId)
      .eq('memberships.user_id', userId)
      .limit(1)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) return null;

    const membership = data.memberships as { role: string } | { role: string }[];
    const role = Array.isArray(membership) ? membership[0]?.role : membership.role;
    return (data.access_role as string | null) ?? role ?? null;
  }

  private async resolveRoleLabel(role: string): Promise<string> {
    const { data, error } = await this.supabase.db
      .from('roles')
      .select('label')
      .eq('code', role)
      .maybeSingle();

    if (error || !data?.label) return role;
    return data.label as string;
  }
}
