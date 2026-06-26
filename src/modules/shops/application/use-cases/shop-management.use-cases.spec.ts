import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { Permission } from '../../../../shared/enums/permission.enum';
import { Shop } from '../../domain/entities/shop.entity';
import { ShopRepository } from '../../domain/repositories/shop.repository';
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
        new Shop(1, 'Akpakpa', null, null, 1, true, true, 1000),
        new Shop(2, 'Ganhi', null, null, 1, true, false, 2000),
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListOwnedShopsUseCase,
        { provide: ShopRepository, useValue: shops },
      ],
    }).compile();

    useCase = module.get(ListOwnedShopsUseCase);
  });

  it('liste les boutiques du patron avec la boutique courante marquée', async () => {
    const result = await useCase.execute(auth);
    expect(result.shops).toHaveLength(2);
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
