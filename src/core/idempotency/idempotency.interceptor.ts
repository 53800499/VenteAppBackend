import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Response as NestResponse,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IDEMPOTENT_SCOPE_KEY } from './idempotent.decorator';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method;

    // Seules les requêtes de mutation (POST, PUT, PATCH, DELETE) supportent l'idempotence
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey =
      request.headers['x-idempotency-key'] || request.headers['X-Idempotency-Key'];

    // Si aucune clé d'idempotence n'est fournie, poursuivre normalement
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      return next.handle();
    }

    // Extraire le scope depuis le décorateur @IdempotentScope ou déduire de la route
    const customScope = this.reflector.get<string>(IDEMPOTENT_SCOPE_KEY, context.getHandler());
    const routePath = request.route?.path || request.url || 'GLOBAL';
    const scope = customScope || `${method}:${routePath}`;

    const auth = request.user || request.currentAuth || {};
    const shopId = auth.shopId || request.headers['x-shop-id'] || 0;
    const userId = auth.userId || auth.id;

    const checkResult = await this.idempotencyService.checkOrLockKey({
      idempotencyKey: idempotencyKey.trim(),
      scope: scope,
      shopId: Number(shopId) || 0,
      userId: userId ? Number(userId) : undefined,
      payload: request.body,
    });

    // Si la réponse est déjà enregistrée en BDD, la renvoyer directement
    if (checkResult.isCached) {
      response.status(checkResult.statusCode || 200);
      return of(checkResult.responseBody);
    }

    const recordId = checkResult.recordId;

    return next.handle().pipe(
      tap((data) => {
        const statusCode = response.statusCode || 200;
        this.idempotencyService.saveSuccessResponse(recordId, statusCode, data);
      }),
      catchError((err) => {
        this.idempotencyService.markFailed(recordId);
        return throwError(() => err);
      }),
    );
  }
}
