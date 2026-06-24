import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../enums/error-code.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import { DomainException } from '../exceptions/domain.exception';
import { InsufficientRoleException } from '../exceptions/rbac.exceptions';
import { AuthenticatedRequest } from '../interfaces/auth-context.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
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
      );
    }

    if (!required.includes(auth.role)) {
      throw new InsufficientRoleException(required, auth.role);
    }

    return true;
  }
}
