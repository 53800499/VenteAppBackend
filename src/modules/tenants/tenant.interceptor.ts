import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { AuthenticatedRequest } from '../../shared/interfaces/auth-context.interface';
import { TenantDatabaseService } from './tenant-database.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const shopId = request.authContext?.shopId;

    if (!shopId) {
      return next.handle();
    }

    // SessionGuard + TenantGuard ont déjà positionné TenantContextService.
    // On assure seulement le contexte RLS Supabase avant le handler.
    return from(this.tenantDb.setShopId(shopId)).pipe(switchMap(() => next.handle()));
  }
}
