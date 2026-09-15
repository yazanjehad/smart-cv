import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Generates a new opaque guest session token (UUID v4). */
  generateSessionToken(): string {
    return randomUUID();
  }

  /**
   * Resolves the effective session token: trims the provided one or
   * mints a brand-new guest session token.
   */
  resolveSessionToken(sessionId?: string | null): string {
    const token = sessionId?.trim();
    return token ? token : this.generateSessionToken();
  }

  /**
   * Fetches the user bound to a session token, creating a free-trial
   * account on first sight. Optionally attaches an email to an
   * anonymous session (guest -> identified upgrade).
   */
  async getOrCreateBySessionToken(
    sessionToken: string,
    email?: string,
  ): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { sessionToken },
    });

    if (existing) {
      if (email && !existing.email) {
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { email },
        });
      }
      return existing;
    }

    const freeCredits = this.config.get<number>('app.credits.freeTrial', 5);
    this.logger.log(`Creating new free-trial session (${freeCredits} credits)`);
    return this.prisma.user.create({
      data: {
        sessionToken,
        email: email ?? null,
        credits: freeCredits,
      },
    });
  }

  /**
   * Pre-flight usage-limit guard. Throws HTTP 402 when the
   * user/session has no remaining credits.
   */
  assertHasCredits(user: User): void {
    if (user.credits <= 0) {
      throw new PaymentRequiredException('analysis.messages.no_credits', {
        creditsRemaining: 0,
      });
    }
  }
}
