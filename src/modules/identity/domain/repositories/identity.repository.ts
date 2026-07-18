import {
  IdentityContext,
  MembershipWithAccess,
  ShopAccessGrant,
  UserShopAccessView,
} from '../entities/identity.entity';

export abstract class IdentityRepository {
  abstract findMembershipsByPhone(phone: string): Promise<MembershipWithAccess[]>;

  abstract findIdentityContext(
    userId: number,
    activeShopId: number,
  ): Promise<IdentityContext | null>;

  abstract userHasShopAccess(userId: number, shopId: number): Promise<boolean>;

  abstract resolveEffectiveRole(userId: number, shopId: number): Promise<string | null>;

  abstract ensureIdentity(phone: string, displayName?: string): Promise<number>;

  abstract linkUserIdentity(userId: number, identityId: number): Promise<void>;

  abstract ensureOwnerOrganization(
    userId: number,
    rootShopId: number,
    organizationName: string,
  ): Promise<number>;

  abstract ensureMembership(
    organizationId: number,
    userId: number,
    role: string,
    identityId?: number | null,
    isPrimary?: boolean,
  ): Promise<number>;

  abstract grantShopAccess(
    membershipId: number,
    shopId: number,
    accessRole?: string | null,
  ): Promise<void>;

  abstract syncOwnerShopAccess(
    userId: number,
    organizationId: number,
    shopIds: number[],
  ): Promise<void>;

  abstract syncStaffShopAccess(
    userId: number,
    organizationId: number,
    shopId: number,
    role: string,
    identityId?: number | null,
    accessRole?: string | null,
  ): Promise<void>;

  abstract replaceMembershipShopAccess(
    membershipId: number,
    grants: ShopAccessGrant[],
  ): Promise<void>;

  abstract findMembershipForUserInOrganization(
    userId: number,
    organizationId: number,
  ): Promise<number | null>;

  abstract findUserShopAccess(
    userId: number,
    rootShopId: number,
  ): Promise<UserShopAccessView | null>;
}
