import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { PermissionService } from '../../../../core/security/permission.service';
import { LockoutPolicyService } from '../../../../core/security/lockout-policy.service';
import { PinHasherService } from '../../../../core/security/pin-hasher.service';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { User } from '../../../users/domain/entities/user.entity';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { AuthTokenService } from '../../domain/services/auth-token.service';
import { UserResolverService } from '../../domain/services/user-resolver.service';
import { AuthPresenter } from '../../presentation/presenters/auth.presenter';
import { LoginWithPinUseCase } from './login-with-pin.use-case';

const baseUser = new User(
  1, 1, 'Kofi', '', UserRole.OWNER, true, null, null, 2, null, 0, null, false, 0, 0, 1,
);

describe('LoginWithPinUseCase', () => {
  let useCase: LoginWithPinUseCase;
  let users: jest.Mocked<Pick<UserRepository, 'updateInShop'>>;

  beforeEach(async () => {
    users = { updateInShop: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginWithPinUseCase,
        LockoutPolicyService,
        PinHasherService,
        AuthPresenter,
        {
          provide: PermissionService,
          useValue: {
            getRoleLabel: jest.fn().mockResolvedValue('Patron'),
            resolveForUser: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (_: string, defaultValue: unknown) => defaultValue,
          },
        },
        {
          provide: UserResolverService,
          useValue: {
            resolve: jest.fn().mockResolvedValue(baseUser),
          },
        },
        { provide: UserRepository, useValue: users },
        {
          provide: SettingsRepository,
          useValue: {
            findByShopId: jest.fn().mockResolvedValue({
              id: 1,
              shopId: 1,
              shopName: 'Ma Boutique',
              shopLogoPath: null,
              autoLockMinutes: 5,
            }),
            getDefault: jest.fn(),
          },
        },
        { provide: ShopRepository, useValue: { findShopById: jest.fn() } },
        {
          provide: AuthTokenService,
          useValue: {
            bootstrapSession: jest.fn().mockResolvedValue({
              session: {
                id: 'session-uuid',
                sessionExpiresAt: Date.now() + 300_000,
              },
              tokens: {
                accessToken: 'access.jwt.token',
                refreshToken: 'refresh-token-hex',
                tokenType: 'Bearer',
                accessExpiresAt: Date.now() + 900_000,
                refreshExpiresAt: Date.now() + 2_592_000_000,
              },
            }),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    useCase = module.get(LoginWithPinUseCase);
  });

  it('rejette un PIN invalide avec tentatives restantes', async () => {
    const pinHash = await bcrypt.hash('1234', 10);
    const user = new User(
      1, 1, 'Kofi', pinHash, UserRole.OWNER, true, null, null, 2, null, 0, null, false, 0, 0, 1,
    );
    (useCase as unknown as { userResolver: UserResolverService }).userResolver = {
      resolve: jest.fn().mockResolvedValue(user),
    } as unknown as UserResolverService;

    await expect(
      useCase.execute({ pin: '9999', shopId: 1, deviceId: 'device-uuid' }),
    ).rejects.toMatchObject({
      response: { remainingAttempts: 2 },
    });
    expect(users.updateInShop).toHaveBeenCalled();
  });

  it('verrouille après 5 échecs consécutifs', async () => {
    const pinHash = await bcrypt.hash('1234', 10);
    const user = new User(
      1, 1, 'Kofi', pinHash, UserRole.OWNER, true, null, null, 4, null, 0, null, false, 0, 0, 1,
    );
    (useCase as unknown as { userResolver: UserResolverService }).userResolver = {
      resolve: jest.fn().mockResolvedValue(user),
    } as unknown as UserResolverService;

    await expect(
      useCase.execute({ pin: '9999', shopId: 1, deviceId: 'device-uuid' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
