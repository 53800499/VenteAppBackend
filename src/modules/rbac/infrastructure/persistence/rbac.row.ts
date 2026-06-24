export interface PermissionModuleRow {
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface PermissionRow {
  code: string;
  module_code: string;
  action: string;
  label: string | null;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
}

export interface RoleRow {
  code: string;
  label: string;
  description: string | null;
  scope: 'system' | 'shop';
  shop_id: number | null;
  priority: number;
  is_active: boolean;
  is_system: boolean;
}

export interface RolePermissionRow {
  role_code: string;
  permission_code: string;
  effect: 'allow' | 'deny';
}

export interface RoleInheritanceRow {
  child_role_code: string;
  parent_role_code: string;
}

export interface UserPermissionOverrideRow {
  id: number;
  user_id: number;
  shop_id: number;
  permission_code: string;
  effect: 'grant' | 'deny';
  reason: string | null;
  granted_by: number | null;
  expires_at: number | null;
  is_active: boolean;
}
