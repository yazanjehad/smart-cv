import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';
import {
  GrantCreditsDto,
  UpdateSubscriptionDto,
  UserProfileDto,
  UserQueryDto,
} from './dto/user.dto';

export type UserWithSubscription = Prisma.UserGetPayload<{
  include: { subscription: true };
}>;

const WITH_SUBSCRIPTION = { subscription: true } satisfies Prisma.UserInclude;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Credits granted to a brand-new account (configurable free trial). */
  freeTrialCredits(): number {
    return this.config.get<number>('app.credits.freeTrial', 5);
  }

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
  }

  /**
   * Creates the JWT-authenticated account together with its 1-1 FREE_TRIAL
   * subscription record (single transaction).
   */
  async createAccount(input: {
    email: string;
    passwordHash: string;
    fullName?: string | null;
    role?: Role;
  }): Promise<User> {
    const credits = this.freeTrialCredits();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: this.normalizeEmail(input.email),
          passwordHash: input.passwordHash,
          fullName: input.fullName?.trim() || null,
          role: input.role ?? Role.JOB_SEEKER,
          credits,
        },
      });

      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: SubscriptionPlan.FREE_TRIAL,
          status: SubscriptionStatus.ACTIVE,
          creditsPerCycle: credits,
          creditsUsed: 0,
          currentPeriodStart: new Date(),
        },
      });

      this.logger.log(
        `Created ${user.role} account (${user.email}) with ${credits} credits`,
      );
      return user;
    });
  }

  recordLogin(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  /** Pre-flight usage-limit guard: HTTP 402 when no credits are left. */
  assertHasCredits(user: Pick<User, 'credits'>): void {
    if (user.credits <= 0) {
      throw new PaymentRequiredException('analysis.messages.no_credits', {
        creditsRemaining: 0,
      });
    }
  }

  async getProfile(userId: string): Promise<UserWithSubscription> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: WITH_SUBSCRIPTION,
    });
    if (!user) {
      throw new NotFoundException('users.errors.not_found');
    }
    return user;
  }

  /** Explicit field mapping — never exposes `passwordHash`. */
  toProfile(user: UserWithSubscription): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      credits: user.credits,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      subscription: user.subscription
        ? {
            id: user.subscription.id,
            plan: user.subscription.plan,
            status: user.subscription.status,
            creditsPerCycle: user.subscription.creditsPerCycle,
            creditsUsed: user.subscription.creditsUsed,
            currentPeriodStart: user.subscription.currentPeriodStart,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
          }
        : null,
    };
  }

  /** SUPER_ADMIN: paginated account list with credit/subscription visibility. */
  async listUsers(query: UserQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { fullName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: WITH_SUBSCRIPTION,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      message: 'users.messages.list',
      data: rows.map((row) => this.toProfile(row)),
      meta: {
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
        creditsInCirculation: rows.reduce((sum, row) => sum + row.credits, 0),
      },
    };
  }

  /** SUPER_ADMIN: top up an account balance (mirrored on its subscription). */
  async grantCredits(
    userId: string,
    dto: GrantCreditsDto,
  ): Promise<UserWithSubscription> {
    await this.assertUserExists(userId);

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: dto.credits } },
      });

      await tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: SubscriptionPlan.FREE_TRIAL,
          status: SubscriptionStatus.ACTIVE,
          creditsPerCycle: dto.credits,
        },
        update: { creditsPerCycle: { increment: dto.credits } },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: WITH_SUBSCRIPTION,
      });
    });

    this.logger.log(`Granted ${dto.credits} credits to ${user.email}`);
    return user;
  }

  /** SUPER_ADMIN: manage the plan/status/usage of an account's subscription. */
  async updateSubscription(
    userId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<UserWithSubscription> {
    await this.assertUserExists(userId);
    const { grantCredits, resetUsage, currentPeriodEnd, ...rest } = dto;

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: rest.plan ?? SubscriptionPlan.FREE_TRIAL,
          status: rest.status ?? SubscriptionStatus.ACTIVE,
          creditsPerCycle: rest.creditsPerCycle ?? this.freeTrialCredits(),
          cancelAtPeriodEnd: rest.cancelAtPeriodEnd ?? false,
          currentPeriodEnd: currentPeriodEnd
            ? new Date(currentPeriodEnd)
            : null,
        },
        update: {
          ...rest,
          ...(currentPeriodEnd
            ? { currentPeriodEnd: new Date(currentPeriodEnd) }
            : {}),
          ...(resetUsage
            ? { creditsUsed: 0, currentPeriodStart: new Date() }
            : {}),
        },
      });

      if (grantCredits) {
        await tx.user.update({
          where: { id: userId },
          data: { credits: { increment: grantCredits } },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: WITH_SUBSCRIPTION,
      });
    });

    this.logger.log(`Subscription of ${user.email} updated (${user.role})`);
    return user;
  }

  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('users.errors.not_found');
    }
  }
}
