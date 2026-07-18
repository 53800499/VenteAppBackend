export class Organization {
  constructor(
    public readonly id: number,
    public readonly rootShopId: number,
    public readonly name: string,
    public readonly createdAt: number,
  ) {}
}

export class Membership {
  constructor(
    public readonly id: number,
    public readonly organizationId: number,
    public readonly userId: number,
    public readonly identityId: number | null,
    public readonly role: string,
    public readonly isPrimary: boolean,
    public readonly createdAt: number,
  ) {}
}

export interface ShopAccessEntry {
  shopId: number;
  shopName: string;
  isDefault: boolean;
  isActive: boolean;
  accessRole: string | null;
}

export interface MembershipWithAccess {
  membershipId: number;
  userId: number;
  identityId: number | null;
  role: string;
  organizationId: number;
  organizationName: string;
  rootShopId: number;
  entryShopId: number;
  entryShopName: string;
  isDefault: boolean;
  accessibleShopIds: number[];
  shopAccess: ShopAccessEntry[];
}

export interface IdentityContext {
  membershipId: number;
  identityId: number | null;
  organizationId: number;
  organizationName: string;
  role: string;
  roleLabel: string;
  effectiveRole: string;
  effectiveRoleLabel: string;
  activeShopId: number;
  activeShopName: string;
  accessibleShops: Array<{
    id: number;
    name: string;
    isCurrent: boolean;
    isDefault: boolean;
    accessRole: string | null;
    roleLabel: string;
  }>;
}

export interface ShopAccessGrant {
  shopId: number;
  accessRole?: string | null;
}

export interface UserShopAccessGrantView {
  shopId: number;
  shopName: string;
  accessRole: string | null;
  effectiveRole: string;
  effectiveRoleLabel: string;
}

export interface UserShopAccessView {
  membershipId: number;
  userId: number;
  role: string;
  roleLabel: string;
  grants: UserShopAccessGrantView[];
}
