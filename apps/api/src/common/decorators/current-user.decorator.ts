import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthedRequest, AuthenticatedUser } from '../guards/supabase-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user;
  },
);
