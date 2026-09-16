import {
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Passport-based bearer-token guard. Replaces the former `x-session-id`
 * handling: the account is resolved from the signed JWT and attached to
 * `req.user` by `JwtStrategy`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    _context?: ExecutionContext,
  ): TUser {
    if (err instanceof HttpException) {
      throw err;
    }
    if (err) {
      throw new UnauthorizedException('auth.errors.unauthorized');
    }
    if (!user) {
      const reason = info instanceof Error ? info.message : '';
      throw new UnauthorizedException(
        /expired/i.test(reason)
          ? 'auth.errors.token_expired'
          : 'auth.errors.unauthorized',
      );
    }
    return user;
  }
}
