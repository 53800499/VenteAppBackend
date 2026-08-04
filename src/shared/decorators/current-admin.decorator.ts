import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminAuthContext, AdminAuthenticatedRequest } from '../guards/admin.guard';

export const CurrentAdmin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AdminAuthContext => {
    const request = ctx.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    return request.adminContext!;
  },
);
