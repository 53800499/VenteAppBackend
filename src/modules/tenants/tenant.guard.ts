import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../shared/interfaces/auth-context.interface';
import { TenantContextRequiredException } from './exceptions/tenant.exceptions';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.authContext;

    if (!auth?.shopId) {
      throw new TenantContextRequiredException();
    }

    if (!this.tenantContext.isSet()) {
      this.tenantContext.setShopId(auth.shopId);
    } else if (this.tenantContext.getShopId() !== auth.shopId) {
      throw new TenantContextRequiredException();
    }

    return true;
  }
}
