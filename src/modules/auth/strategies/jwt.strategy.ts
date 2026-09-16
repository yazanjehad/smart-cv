import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import type {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/authenticated-user.interface';

const DEV_FALLBACK_SECRET = 'smart-cv-dev-secret-change-me';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwt.secret') ?? DEV_FALLBACK_SECRET,
    });
  }

  /**
   * Re-reads the account on every request, so role changes, deactivations and
   * credit movements are reflected immediately by the guards/pipeline.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('auth.errors.inactive_account');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      credits: user.credits,
      isActive: user.isActive,
    };
  }
}
