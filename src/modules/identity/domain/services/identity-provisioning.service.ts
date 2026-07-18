import { Injectable } from '@nestjs/common';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { ShopAccessGrant } from '../entities/identity.entity';
import { IdentityRepository } from '../repositories/identity.repository';

@Injectable()
export class IdentityProvisioningService {
  constructor(private readonly identity: IdentityRepository) {}

  async provisionIdentityForUser(input: {
    phone: string;
    displayName?: string;
    userId: number;
  }): Promise<number> {
    const identityId = await this.identity.ensureIdentity(
      input.phone,
      input.displayName,
    );
    await this.identity.linkUserIdentity(input.userId, identityId);
    return identityId;
  }

  async provisionNewOwnerShop(input: {
    phone: string;
    displayName: string;
    userId: number;
    shopId: number;
    shopName: string;
  }): Promise<void> {
    const identityId = await this.provisionIdentityForUser({
      phone: input.phone,
      displayName: input.displayName,
      userId: input.userId,
    });

    const organizationId = await this.identity.ensureOwnerOrganization(
      input.userId,
      input.shopId,
      input.shopName,
    );
    const membershipId = await this.identity.ensureMembership(
      organizationId,
      input.userId,
      UserRole.OWNER,
      identityId,
    );
    await this.identity.grantShopAccess(membershipId, input.shopId, null);
  }

  async provisionOwnerGroupAccess(
    userId: number,
    rootShopId: number,
    organizationName: string,
    shopIds: number[],
    identityId?: number | null,
  ): Promise<void> {
    const organizationId = await this.identity.ensureOwnerOrganization(
      userId,
      rootShopId,
      organizationName,
    );
    await this.identity.ensureMembership(
      organizationId,
      userId,
      UserRole.OWNER,
      identityId ?? null,
    );
    await this.identity.syncOwnerShopAccess(userId, organizationId, shopIds);
  }

  async provisionStaffUser(input: {
    phone?: string | null;
    displayName: string;
    userId: number;
    rootShopId: number;
    organizationName: string;
    shopId: number;
    role: string;
    accessRole?: string | null;
  }): Promise<void> {
    let identityId: number | null = null;
    if (input.phone?.trim()) {
      identityId = await this.provisionIdentityForUser({
        phone: input.phone.trim(),
        displayName: input.displayName,
        userId: input.userId,
      });
    }

    const organizationId = await this.identity.ensureOwnerOrganization(
      input.userId,
      input.rootShopId,
      input.organizationName,
    );
    await this.identity.syncStaffShopAccess(
      input.userId,
      organizationId,
      input.shopId,
      input.role,
      identityId,
      input.accessRole ?? null,
    );
  }

  async replaceStaffShopAccess(
    membershipId: number,
    grants: ShopAccessGrant[],
  ): Promise<void> {
    await this.identity.replaceMembershipShopAccess(membershipId, grants);
  }
}
