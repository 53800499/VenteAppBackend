import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../interfaces/auth-context.interface';

export const CurrentUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<{ authContext?: AuthContext }>();
    return request.authContext?.userId ?? 0;
  },
);
