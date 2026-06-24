import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../enums/error-code.enum';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../enums/permission.enum';
import { DomainException } from '../exceptions/domain.exception';
import { InsufficientPermissionException } from '../exceptions/rbac.exceptions';
import { AuthenticatedRequest } from '../interfaces/auth-context.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.authContext;

    if (!auth) {
      throw new DomainException(
        ErrorCode.AUTH_SESSION_REQUIRED,
        'Session requise.',
        HttpStatus.UNAUTHORIZED,
        undefined,
        'Connectez-vous avec votre code PIN.',
      );
    }

    const missing = required.filter((p) => !auth.permissions.includes(p));
    if (missing.length > 0) {
      throw new InsufficientPermissionException(required, missing, auth.role);
    }

    return true;
  }
}
