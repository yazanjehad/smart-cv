import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import type { JwtPayload } from './interfaces/authenticated-user.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Registers a RECRUITER/JOB_SEEKER account (free-trial credits included) and
   * returns a signed access token so the caller can hit the pipeline at once.
   */
  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('auth.errors.email_taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds());
    const user = await this.users.createAccount({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
    });

    return this.buildAuthResponse(user, 'auth.messages.registered');
  }

  /** Verifies credentials (bcrypt) and issues a fresh access token. */
  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const passwordMatches =
      !!user?.passwordHash &&
      (await bcrypt.compare(dto.password, user.passwordHash));

    if (!user || !passwordMatches) {
      this.logger.warn(`Failed login attempt for ${dto.email}`);
      throw new UnauthorizedException('auth.errors.invalid_credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('auth.errors.inactive_account');
    }

    const updated = await this.users.recordLogin(user.id);
    return this.buildAuthResponse(updated, 'auth.messages.logged_in');
  }

  /** JWT-authenticated profile (role, credits and subscription). */
  async profile(userId: string) {
    const user = await this.users.getProfile(userId);
    return {
      message: 'auth.messages.profile',
      data: this.users.toProfile(user),
    };
  }

  private async buildAuthResponse(user: User, message: string) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const profile = await this.users.getProfile(user.id);

    return {
      message,
      data: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: this.config.get<string>('app.jwt.expiresIn', '1d'),
        user: this.users.toProfile(profile),
      },
    };
  }

  private saltRounds(): number {
    return this.config.get<number>('app.jwt.saltRounds', 10);
  }
}
