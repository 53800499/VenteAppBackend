import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionService } from '../../core/security/permission.service';
import { TenantContextService } from '../../modules/tenants/tenant-context.service';
import { TenantDatabaseService } from '../../modules/tenants/tenant-database.service';
import { AuthSessionRepository } from '../../modules/auth/domain/repositories/auth-session.repository';
import { UserRepository } from '../../modules/users/domain/repositories/user.repository';
import { AuthContext, AuthenticatedRequest } from '../interfaces/auth-context.interface';
import { nowMs } from '../utils/time.util';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: AuthSessionRepository,
    private readonly users: UserRepository,
    private readonly permissionService: PermissionService,
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const headerName = this.configService.get<string>('auth.sessionHeader', 'x-session-token');
    const token = request.headers[headerName];
    if (!token) {
      throw new UnauthorizedException('Session requise.');
    }

    const session = await this.sessions.findById(token);
    if (!session || session.expiresAt <= nowMs()) {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }

    await this.tenantDb.setShopId(session.shopId);
    this.tenantContext.setShopId(session.shopId);

    const user = await this.users.findByIdAndShop(session.userId, session.shopId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur introuvable ou désactivé.');
    }

    if (user.shopId !== session.shopId) {
      throw new UnauthorizedException('Session incompatible avec l\'utilisateur.');
    }

    request.authContext = {
      userId: user.id,
      shopId: user.shopId,
      role: user.role,
      permissions: await this.permissionService.resolveForUser({
        userId: user.id,
        role: user.role,
        shopId: user.shopId,
      }),
      sessionToken: token,
    };

    return true;
  }
}
