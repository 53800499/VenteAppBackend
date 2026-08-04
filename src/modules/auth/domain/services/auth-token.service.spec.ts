import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { InvalidRefreshTokenException } from '../../../../shared/exceptions/jwt-auth.exceptions';
import { UserSession } from '../entities/user-session.entity';
import { UserSessionRepository } from '../repositories/user-session.repository';
import { AuthTokenService } from './auth-token.service';
import { User } from '../../../users/domain/entities/user.entity';
import { ShopSettings } from '../../../shops/domain/entities/shop.entity';

describe('AuthTokenService', () => {
  let service: AuthTokenService;
  let sessions: jest.Mocked<
    Pick<
      UserSessionRepository,
      | 'create'
      | 'findByRefreshTokenHash'
      | 'revokeById'
      | 'revokeActiveByDevice'
      | 'updateRefreshToken'
    >
  >;

  const now = Date.now();
  const session = new UserSession(
    'sid-1',
    1,
    1,
    'device-1',
    'Tablette',
    'hash',
    now,
    now,
    now + 300_000,
    now + 2_592_000_000,
    null,
    null,
    now,
  );
  const user = new User(1, 1, 'Kofi', 'hash', UserRole.OWNER, true, null, null, 0, null, 0, null, false, 0, 0, 1);
  const settings = new ShopSettings(1, 1, 'Ma Boutique', null, 5);

  beforeEach(async () => {
    sessions = {
      create: jest.fn().mockResolvedValue(session),
      findByRefreshTokenHash: jest.fn(),
      revokeById: jest.fn().mockResolvedValue(undefined),
      revokeActiveByDevice: jest.fn().mockResolvedValue(undefined),
      updateRefreshToken: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthTokenService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('jwt.access.token'),
            verifyAsync: jest.fn().mockResolvedValue({ sub: 1, role: 'owner', sid: 'sid-1', type: 'access' }),
          },
        },
        { provide: UserSessionRepository, useValue: sessions },
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, defaultValue: unknown) => defaultValue,
          },
        },
      ],
    }).compile();

    service = module.get(AuthTokenService);
  });

  it('crée une session unifiée et émet une paire access + refresh au login', async () => {
    const result = await service.bootstrapSession(user, settings.shopId, settings, {
      deviceId: 'device-1',
      deviceLabel: 'Tablette',
    });
    expect(result.tokens.accessToken).toBe('jwt.access.token');
    expect(result.tokens.refreshToken).toHaveLength(64);
    expect(result.tokens.tokenType).toBe('Bearer');
    expect(sessions.revokeActiveByDevice).toHaveBeenCalled();
    expect(sessions.create).toHaveBeenCalled();
  });

  it('rejette un refresh token inconnu', async () => {
    sessions.findByRefreshTokenHash.mockResolvedValue(null);
    await expect(service.validateRefreshToken('unknown')).rejects.toThrow(InvalidRefreshTokenException);
  });

  it('valide un jeton utilisateur avec sid', async () => {
    const payload = await service.verifyAccessToken('valid.user.token');
    expect(payload.sid).toBe('sid-1');
  });

  it('valide un jeton administrateur sans sid', async () => {
    const jwtService = (service as any).jwtService;
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'admin-001',
      email: 'admin@arike.app',
      isAdmin: true,
      adminRole: 'SUPER_ADMIN',
      type: 'access',
    });

    const payload = await service.verifyAccessToken('valid.admin.token');
    expect(payload.isAdmin).toBe(true);
    expect(payload.sid).toBeUndefined();
  });
});
