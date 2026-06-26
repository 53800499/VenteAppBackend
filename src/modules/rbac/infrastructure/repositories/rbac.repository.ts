import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import {
  CreateOverrideInput,
  CreateShopRoleInput,
  PermissionDefinition,
  PermissionModule,
  RoleDefinition,
  RolePermissionGrant,
  UpdateShopRoleInput,
  UserPermissionOverride,
} from '../../domain/entities/rbac.entity';
import { RbacRepository } from '../../domain/repositories/rbac.repository';
import { RbacMapper } from '../mappers/rbac.mapper';
import {
  PermissionModuleRow,
  PermissionRow,
  RoleInheritanceRow,
  RolePermissionRow,
  RoleRow,
  UserPermissionOverrideRow,
} from '../persistence/rbac.row';

@Injectable()
export class SupabaseRbacRepository extends RbacRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findAllModules(): Promise<PermissionModule[]> {
    const { data, error } = await this.supabase.db
      .from('permission_modules')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => RbacMapper.toModule(row as PermissionModuleRow));
  }

  async findAllPermissions(activeOnly = true): Promise<PermissionDefinition[]> {
    let query = this.supabase.db.from('permissions').select('*').order('sort_order');
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => RbacMapper.toPermission(row as PermissionRow));
  }

  async findPermissionCodes(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const { data, error } = await this.supabase.db
      .from('permissions')
      .select('code')
      .in('code', codes)
      .eq('is_active', true);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => row.code as string);
  }

  async findAllRoles(shopId?: number): Promise<RoleDefinition[]> {
    let query = this.supabase.db.from('roles').select('*').eq('is_active', true);
    if (shopId !== undefined) {
      query = query.or(`scope.eq.system,shop_id.eq.${shopId}`);
    }
    const { data, error } = await query.order('priority', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => RbacMapper.toRole(row as RoleRow));
  }

  async findRoleByCode(code: string): Promise<RoleDefinition | null> {
    const { data, error } = await this.supabase.db
      .from('roles')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? RbacMapper.toRole(data as RoleRow) : null;
  }

  async roleExists(code: string): Promise<boolean> {
    const { count, error } = await this.supabase.db
      .from('roles')
      .select('code', { count: 'exact', head: true })
      .eq('code', code);
    if (error) throw new BadRequestException(error.message);
    return (count ?? 0) > 0;
  }

  async findDirectRolePermissions(roleCode: string): Promise<RolePermissionGrant[]> {
    const { data, error } = await this.supabase.db
      .from('role_permissions')
      .select('role_code, permission_code, effect')
      .eq('role_code', roleCode);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => RbacMapper.toGrant(row as RolePermissionRow));
  }

  async findParentRoleCodes(roleCode: string): Promise<string[]> {
    const { data, error } = await this.supabase.db
      .from('role_inheritance')
      .select('parent_role_code')
      .eq('child_role_code', roleCode);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => (row as RoleInheritanceRow).parent_role_code);
  }

  async findActiveUserOverrides(userId: number, shopId: number): Promise<UserPermissionOverride[]> {
    const { data, error } = await this.supabase.db
      .from('user_permission_overrides')
      .select('*')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .eq('is_active', true);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => RbacMapper.toOverride(row as UserPermissionOverrideRow));
  }

  async findUserOverrides(userId: number, shopId: number): Promise<UserPermissionOverride[]> {
    const { data, error } = await this.supabase.db
      .from('user_permission_overrides')
      .select('*')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => RbacMapper.toOverride(row as UserPermissionOverrideRow));
  }

  async createShopRole(input: CreateShopRoleInput): Promise<RoleDefinition> {
    const timestamp = nowMs();
    const { data, error } = await this.supabase.db
      .from('roles')
      .insert({
        code: input.code,
        label: input.label,
        description: input.description ?? null,
        scope: 'shop',
        shop_id: input.shopId,
        is_system: false,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException(error?.message ?? 'Création rôle impossible.');

    if (input.parentRoleCode) {
      await this.setRoleInheritance(input.code, input.parentRoleCode);
    }
    if (input.permissions.length > 0) {
      await this.setRolePermissions(input.code, input.permissions);
    }

    return RbacMapper.toRole(data as RoleRow);
  }

  async updateShopRole(code: string, input: UpdateShopRoleInput): Promise<RoleDefinition> {
    const patch: Record<string, unknown> = { updated_at: nowMs() };
    if (input.label !== undefined) patch.label = input.label;
    if (input.description !== undefined) patch.description = input.description;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { data, error } = await this.supabase.db
      .from('roles')
      .update(patch)
      .eq('code', code)
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException(error?.message ?? 'Mise à jour rôle impossible.');

    if (input.permissions) {
      await this.setRolePermissions(code, input.permissions);
    }

    return RbacMapper.toRole(data as RoleRow);
  }

  async deleteShopRole(code: string): Promise<void> {
    const { error } = await this.supabase.db.from('roles').delete().eq('code', code);
    if (error) throw new BadRequestException(error.message);
  }

  async setRolePermissions(roleCode: string, grants: RolePermissionGrant[]): Promise<void> {
    const { error: deleteError } = await this.supabase.db
      .from('role_permissions')
      .delete()
      .eq('role_code', roleCode);
    if (deleteError) throw new BadRequestException(deleteError.message);

    if (grants.length === 0) return;

    const timestamp = nowMs();
    const { error } = await this.supabase.db.from('role_permissions').insert(
      grants.map((g) => ({
        role_code: roleCode,
        permission_code: g.permissionCode,
        effect: g.effect,
        created_at: timestamp,
      })),
    );
    if (error) throw new BadRequestException(error.message);
  }

  async setRoleInheritance(childCode: string, parentCode: string): Promise<void> {
    const { error } = await this.supabase.db.from('role_inheritance').upsert({
      child_role_code: childCode,
      parent_role_code: parentCode,
      created_at: nowMs(),
    });
    if (error) throw new BadRequestException(error.message);
  }

  async removeRoleInheritance(childCode: string, parentCode: string): Promise<void> {
    const { error } = await this.supabase.db
      .from('role_inheritance')
      .delete()
      .eq('child_role_code', childCode)
      .eq('parent_role_code', parentCode);
    if (error) throw new BadRequestException(error.message);
  }

  async createUserOverride(input: CreateOverrideInput): Promise<UserPermissionOverride> {
    const timestamp = nowMs();
    const { data, error } = await this.supabase.db
      .from('user_permission_overrides')
      .upsert(
        {
          user_id: input.userId,
          shop_id: input.shopId,
          permission_code: input.permissionCode,
          effect: input.effect,
          reason: input.reason ?? null,
          granted_by: input.grantedBy,
          expires_at: input.expiresAt ?? null,
          is_active: true,
          updated_at: timestamp,
          created_at: timestamp,
        },
        { onConflict: 'user_id,permission_code' },
      )
      .select('*')
      .single();
    if (error || !data) throw new BadRequestException(error?.message ?? 'Override impossible.');
    return RbacMapper.toOverride(data as UserPermissionOverrideRow);
  }

  async deactivateUserOverride(userId: number, shopId: number, permissionCode: string): Promise<void> {
    const { error } = await this.supabase.db
      .from('user_permission_overrides')
      .update({ is_active: false, updated_at: nowMs() })
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .eq('permission_code', permissionCode);
    if (error) throw new BadRequestException(error.message);
  }

  async deactivateAllUserOverrides(userId: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('user_permission_overrides')
      .update({ is_active: false, updated_at: nowMs() })
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error) throw new BadRequestException(error.message);
  }

  async updateOverridesShopForUser(userId: number, shopId: number): Promise<void> {
    const { error } = await this.supabase.db
      .from('user_permission_overrides')
      .update({ shop_id: shopId, updated_at: nowMs() })
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error) throw new BadRequestException(error.message);
  }

  async replaceUserOverrides(
    userId: number,
    shopId: number,
    overrides: CreateOverrideInput[],
  ): Promise<UserPermissionOverride[]> {
    await this.deactivateAllUserOverrides(userId);

    const results: UserPermissionOverride[] = [];
    for (const input of overrides) {
      const override = await this.createUserOverride({
        ...input,
        userId,
        shopId,
      });
      results.push(override);
    }
    return results;
  }
}
