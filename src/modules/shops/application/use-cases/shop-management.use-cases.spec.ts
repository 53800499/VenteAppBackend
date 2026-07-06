import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { Permission } from '../../../../shared/enums/permission.enum';
import { Shop } from '../../domain/entities/shop.entity';
import { ShopRepository } from '../../domain/repositories/shop.repository';
import { ShopHierarchyService } from '../../domain/services/shop-hierarchy.service';
import { ListOwnedShopsUseCase } from './shop-management.use-cases';

describe('ListOwnedShopsUseCase', () => {
  let useCase: ListOwnedShopsUseCase;
  let shops: jest.Mocked<Pick<ShopRepository, 'findByOwnerUserId'>>;

  const auth: AuthContext = {
    userId: 1,
    shopId: 1,
    role: UserRole.OWNER,
    permissions: [Permission.SHOPS_READ],
    sessionId: 'session-1',
  };

  beforeEach(async () => {
    shops = {
      findByOwnerUserId: jest.fn().mockResolvedValue([
        new Shop(1, 'Akpakpa', null, null, 1, true, true, 1000, null),
        new Shop(2, 'Ganhi', null, null, 1, true, false, 2000, 1),
        new Shop(3, 'Porto', null, null, 1, true, false, 3000, null),
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListOwnedShopsUseCase,
        ShopHierarchyService,
        { provide: ShopRepository, useValue: shops },
      ],
    }).compile();

    useCase = module.get(ListOwnedShopsUseCase);
  });

  it('liste uniquement le réseau de la boutique active', async () => {
    const result = await useCase.execute(auth);
    expect(result.shops).toHaveLength(2);
    expect(result.shops.map((shop) => shop.id)).toEqual([1, 2]);
    expect(result.activeShopId).toBe(1);
    expect(result.shops[0].isCurrent).toBe(true);
    expect(result.shops[1].isCurrent).toBe(false);
  });

  it('refuse les vendeurs', async () => {
    await expect(
      useCase.execute({ ...auth, role: UserRole.SELLER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
