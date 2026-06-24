import { Test } from '@nestjs/testing';
import { PermissionService } from './permission.service';
import { Permission } from '../../shared/enums/permission.enum';
import { UserRole } from '../../shared/enums/user-role.enum';
import { ROLE_PERMISSIONS } from '../../shared/constants/role-permissions.map';
import { EffectivePermissionResolver } from '../../modules/rbac/domain/services/effective-permission.resolver';
import { RbacRepository } from '../../modules/rbac/domain/repositories/rbac.repository';

describe('PermissionService', () => {
  let service: PermissionService;

  const mockResolver = {
    resolve: jest.fn().mockImplementation(async ({ role }: { role: UserRole }) => {
      return [...ROLE_PERMISSIONS[role]];
    }),
    invalidateUser: jest.fn(),
    invalidateRole: jest.fn(),
  };

  const mockRbac = {
    findRoleByCode: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: EffectivePermissionResolver, useValue: mockResolver },
        { provide: RbacRepository, useValue: mockRbac },
      ],
    }).compile();
    service = module.get(PermissionService);
  });

  it('accorde toutes les permissions au patron', async () => {
    const perms = await service.resolveForUser({ userId: 1, role: UserRole.OWNER, shopId: 1 });
    expect(perms).toContain(Permission.SALES_CANCEL);
    expect(perms).toContain(Permission.AUDIT_READ);
  });

  it('refuse l\'annulation de vente au vendeur', async () => {
    const perms = await service.resolveForUser({ userId: 2, role: UserRole.SELLER, shopId: 1 });
    expect(perms).not.toContain(Permission.SALES_CANCEL);
    expect(perms).toContain(Permission.SALES_CREATE);
  });

  it('limite le lecteur en lecture seule', async () => {
    const perms = await service.resolveForUser({ userId: 3, role: UserRole.VIEWER, shopId: 1 });
    expect(perms).toContain(Permission.SALES_READ);
    expect(perms).not.toContain(Permission.SALES_CREATE);
  });

  it('fallback statique via hasPermission', () => {
    expect(service.hasPermission(UserRole.OWNER, Permission.RBAC_MANAGE)).toBe(true);
    expect(service.hasPermission(UserRole.VIEWER, Permission.RBAC_MANAGE)).toBe(false);
  });
});
