import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PermissionService } from '../../core/security/permission.service';
import { AuthTokenService } from '../../modules/auth/domain/services/auth-token.service';
import { UserSessionRepository } from '../../modules/auth/domain/repositories/user-session.repository';
import { ShopOwnershipService } from '../../modules/shops/domain/services/shop-ownership.service';
import { SettingsRepository } from '../../modules/shops/domain/repositories/settings.repository';
import { TenantContextService } from '../../modules/tenants/tenant-context.service';
import { TenantDatabaseService } from '../../modules/tenants/tenant-database.service';
import { UserRepository } from '../../modules/users/domain/repositories/user.repository';
import { TouchSessionUseCase } from '../../modules/auth/application/use-cases/touch-session.use-case';
import { AuthenticatedRequest } from '../interfaces/auth-context.interface';
import {
  extractActiveShopIdHeader,
  extractBearerToken,
  requireBearerJwt,
} from '../utils/auth-header.util';
import { msFromMinutes, nowMs } from '../utils/time.util';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: UserSessionRepository,
    private readonly users: UserRepository,
    private readonly ownership: ShopOwnershipService,
    private readonly permissionService: PermissionService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDb: TenantDatabaseService,
    private readonly authTokenService: AuthTokenService,
    private readonly touchSession: TouchSessionUseCase,
    private readonly settings: SettingsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const headers = request.headers as Record<string, string | string[] | undefined>;

    const bearer = requireBearerJwt(extractBearerToken(headers));
    const payload = await this.authTokenService.verifyAccessToken(bearer);

    let session = await this.sessions.findById(payload.sid);
    const timestamp = nowMs();
    if (!session || session.isRevoked()) {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }

    // Offline-first : `session_expires_at` suit autoLockMinutes (verrou PIN),
    // souvent plus court que le JWT refresh. Si le refresh est encore valide,
    // on ravive la session plutôt que de bloquer (ex. changement de boutique).
    if (!session.isSessionActive(timestamp)) {
      if (!session.isRefreshActive(timestamp)) {
        throw new UnauthorizedException('Session invalide ou expirée.');
      }
      const shopSettings =
        (await this.settings.findByShopId(session.shopId)) ??
        this.settings.getDefault(session.shopId);
      const revivedExpiresAt =
        timestamp + msFromMinutes(Math.max(shopSettings.autoLockMinutes, 60));
      await this.sessions.touchById(session.id, timestamp, revivedExpiresAt);
      const revived = await this.sessions.findById(payload.sid);
      if (!revived || !revived.isSessionActive(timestamp)) {
        throw new UnauthorizedException('Session invalide ou expirée.');
      }
      session = revived;
    }

    if (session.userId !== payload.sub) {
      throw new UnauthorizedException('JWT incompatible avec la session.');
    }

    const baseUser = await this.users.findById(payload.sub);
    if (!baseUser || !baseUser.isActive) {
      throw new UnauthorizedException('Utilisateur introuvable ou désactivé.');
    }

    const activeShopId = await this.ownership.resolveActiveShop(
      baseUser.id,
      baseUser.role,
      baseUser.shopId,
      session.shopId,
      extractActiveShopIdHeader(headers),
    );

    await this.tenantDb.setShopId(activeShopId);
    this.tenantContext.setShopId(activeShopId);

    const user = (await this.ownership.resolveUserForShop(baseUser.id, activeShopId)) ?? baseUser;

    request.authContext = {
      userId: user.id,
      shopId: activeShopId,
      role: user.role,
      permissions: await this.permissionService.resolveForUser({
        userId: user.id,
        role: user.role,
        shopId: activeShopId,
      }),
      sessionId: session.id,
    };

    // Prolonger la session en arrière-plan si le dernier contact date de plus de 1 minute
    if (timestamp - session.lastSeenAt > 60000) {
      this.touchSession.execute(session.id, activeShopId).catch(() => {
        // Ignorer l'échec (ne pas bloquer la requête)
      });
    }

    return true;
  }
}
