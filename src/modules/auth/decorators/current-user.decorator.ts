import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  AuthenticatedUser,
  RequestWithUser,
} from '../interfaces/authenticated-user.interface';

/**
 * Injects the JWT-authenticated user (replaces the old `sessionToken`
 * extraction from headers/query strings).
 *
 *   evaluate(@CurrentUser() user: AuthenticatedUser)
 *   evaluate(@CurrentUser('id') userId: string)
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
