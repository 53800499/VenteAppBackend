import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const SessionToken = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    return request.headers['x-session-token'];
  },
);

export const CurrentUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    return Number(request.headers['x-user-id']);
  },
);
