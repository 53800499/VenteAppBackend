import { ShopHierarchyService } from '../../../shops/domain/services/shop-hierarchy.service';
import { Shop } from '../../../shops/domain/entities/shop.entity';
import { IdentityRepository } from '../../../identity/domain/repositories/identity.repository';
import {
  MembershipResolverService,
  ShopMembershipDto,
} from './membership-resolver.service';

describe('MembershipResolverService', () => {
  const hierarchy = new ShopHierarchyService();

  const users = {
    findActiveByPhone: jest.fn(),
  };
  const shops = {
    findByOwnerUserId: jest.fn(),
    findShopById: jest.fn(),
  };
  const permissionService = {
    getRoleLabel: jest.fn(async (role: string) => role),
  };
  const tenantDb = {
    runWithoutTenant: jest.fn(async (fn: () => Promise<unknown>) => fn()),
  };
  const identity = {
    findMembershipsByPhone: jest.fn(async () => []),
  };

  let service: MembershipResolverService;

  beforeEach(() => {
    jest.clearAllMocks();
    identity.findMembershipsByPhone.mockResolvedValue([]);
    service = new MembershipResolverService(
      users as never,
      shops as never,
      permissionService as never,
      tenantDb as never,
      hierarchy,
      identity as never,
    );
  });

  it('regroupe les boutiques d\'un patron en un membership organisation (legacy)', async () => {
    users.findActiveByPhone.mockResolvedValue([
      { id: 10, role: 'owner', shopId: 1, isActive: true },
    ]);

    const owned: Shop[] = [
      {
        id: 1,
        name: 'SOGEMAT',
        isActive: true,
        isDefault: true,
        parentShopId: null,
      } as Shop,
      {
        id: 2,
        name: 'Porto',
        isActive: true,
        isDefault: false,
        parentShopId: 1,
      } as Shop,
      {
        id: 3,
        name: 'Parakou',
        isActive: true,
        isDefault: false,
        parentShopId: 1,
      } as Shop,
    ];
    shops.findByOwnerUserId.mockResolvedValue(owned);

    const memberships = await service.resolveByPhone('+22990123456');

    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      userId: 10,
      shopId: 1,
      shopName: 'SOGEMAT',
      scopeType: 'organization',
      organizationName: 'SOGEMAT',
      shopCount: 3,
      accessibleShopIds: [1, 2, 3],
    });
  });

  it('utilise les memberships persistés quand disponibles', async () => {
    identity.findMembershipsByPhone.mockResolvedValue([
      {
        membershipId: 99,
        userId: 10,
        role: 'owner',
        organizationId: 7,
        organizationName: 'SOGEMAT',
        rootShopId: 1,
        entryShopId: 1,
        entryShopName: 'SOGEMAT',
        isDefault: true,
        accessibleShopIds: [1, 2, 3],
      },
    ]);

    const memberships = await service.resolveByPhone('+22990123456');

    expect(users.findActiveByPhone).not.toHaveBeenCalled();
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      membershipId: 99,
      organizationId: 7,
      scopeType: 'organization',
    });
  });

  it('conserve un membership boutique pour un vendeur', async () => {
    users.findActiveByPhone.mockResolvedValue([
      { id: 20, role: 'seller', shopId: 5, isActive: true },
    ]);
    shops.findShopById.mockResolvedValue({
      id: 5,
      name: 'Agence Nord',
      isActive: true,
      isDefault: false,
    });

    const memberships = await service.resolveByPhone('+22990123456');

    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      userId: 20,
      shopId: 5,
      shopName: 'Agence Nord',
      scopeType: 'shop',
      shopCount: 1,
    });
  });

  it('accepte la connexion sur une boutique accessible du groupe', () => {
    const membership: ShopMembershipDto = {
      userId: 10,
      shopId: 1,
      shopName: 'SOGEMAT',
      role: 'owner',
      roleLabel: 'Patron',
      isDefault: true,
      scopeType: 'organization',
      organizationName: 'SOGEMAT',
      shopCount: 3,
      accessibleShopIds: [1, 2, 3],
    };

    expect(service.matchesSelection(membership, 10, 3)).toBe(true);
    expect(service.matchesSelection(membership, 10, 99)).toBe(false);
  });
});
