import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { AuthenticatedRequest } from '../../shared/interfaces/auth-context.interface';
import { TenantContextService } from './tenant-context.service';
import { TenantDatabaseService } from './tenant-database.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const shopId = request.authContext?.shopId;

    if (!shopId) {
      return next.handle();
    }

    if (!this.tenantContext.isSet()) {
      this.tenantContext.setShopId(shopId);
    }

    return from(this.tenantDb.setShopId(shopId)).pipe(switchMap(() => next.handle()));
  }
}
