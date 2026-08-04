import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthTokenService } from '../../modules/auth/domain/services/auth-token.service';
import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';
import { AdminRole } from '../enums/admin-role.enum';
import { extractBearerToken } from '../utils/auth-header.util';

export interface AdminAuthContext {
  adminId: string;
  email: string;
  role: AdminRole;
}

export interface AdminAuthenticatedRequest extends Request {
  adminContext?: AdminAuthContext;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    const headers = (request.headers as unknown) as Record<string, string | string[] | undefined>;
    const token = extractBearerToken(headers);

    if (!token) {
      throw new UnauthorizedException('Jeton administrateur requis.');
    }

    try {
      const payload = await this.authTokenService.verifyAccessToken(token) as any;
      if (!payload.isAdmin || !payload.adminRole) {
        throw new ForbiddenException('Accès réservé au back-office administrateur ARIKE.');
      }

      const adminRole = payload.adminRole as AdminRole;

      if (requiredRoles && requiredRoles.length > 0) {
        if (!requiredRoles.includes(adminRole) && adminRole !== AdminRole.SUPER_ADMIN) {
          throw new ForbiddenException('Permissions insuffisantes pour cette opération d\'administration.');
        }
      }

      request.adminContext = {
        adminId: payload.sub,
        email: payload.email || 'admin@arike.app',
        role: adminRole,
      };

      return true;
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Jeton administrateur invalide ou expiré.');
    }
  }
}
