import { NotFoundException } from '@nestjs/common';
import {
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
} from '@prisma/client';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';
import { UsersService } from './users.service';

const userRow: User = {
  id: 'user-1',
  email: 'recruiter@company.com',
  passwordHash: 'bcrypt-hash',
  fullName: 'Nadia Haddad',
  role: Role.RECRUITER,
  credits: 50,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const subRow = {
  id: 'sub-1',
  userId: userRow.id,
  plan: SubscriptionPlan.PRO,
  status: SubscriptionStatus.ACTIVE,
  creditsPerCycle: 50,
  creditsUsed: 3,
  currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const rowWithSubscription = { ...userRow, subscription: subRow };

/** UsersService with a fully mocked Prisma/ConfigService (no database). */
function createHarness() {
  const tx = {
    user: {
      create: jest.fn().mockResolvedValue(userRow),
      update: jest.fn().mockResolvedValue(userRow),
      findUniqueOrThrow: jest.fn().mockResolvedValue(rowWithSubscription),
    },
    subscription: {
      create: jest.fn().mockResolvedValue(subRow),
      upsert: jest.fn().mockResolvedValue(subRow),
    },
  };

  const prisma = {
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: unknown) => unknown)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
    user: {
      findUnique: jest.fn().mockResolvedValue(rowWithSubscription),
      findMany: jest.fn().mockResolvedValue([rowWithSubscription]),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue(userRow),
    },
  };

  const config = { get: jest.fn().mockReturnValue(5) };
  const service = new UsersService(prisma as never, config as never);
  return { service, prisma, tx, config };
}

describe('UsersService.createAccount', () => {
  it('creates the account with normalized email + free-trial credits and its subscription', async () => {
    const { service, tx, config } = createHarness();

    const user = await service.createAccount({
      email: '  New.User@Example.com ',
      passwordHash: 'hashed',
      fullName: '  New User ',
    });

    expect(config.get).toHaveBeenCalledWith('app.credits.freeTrial', 5);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: 'new.user@example.com',
        passwordHash: 'hashed',
        fullName: 'New User',
        role: Role.JOB_SEEKER,
        credits: 5,
      },
    });
    expect(tx.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: userRow.id,
        plan: SubscriptionPlan.FREE_TRIAL,
        status: SubscriptionStatus.ACTIVE,
        creditsPerCycle: 5,
        creditsUsed: 0,
      }),
    });
    expect(user.id).toBe(userRow.id);
  });

  it('honours an explicit role and a blank full name', async () => {
    const { service, tx } = createHarness();

    await service.createAccount({
      email: 'super@smartcv.dev',
      passwordHash: 'hashed',
      fullName: '   ',
      role: Role.SUPER_ADMIN,
    });

    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: Role.SUPER_ADMIN, fullName: null }),
    });
  });
});

describe('UsersService.assertHasCredits', () => {
  it('passes when the account still has credits', () => {
    const { service } = createHarness();

    expect(() => service.assertHasCredits({ credits: 1 })).not.toThrow();
  });

  it('throws 402 with creditsRemaining: 0 when the balance is exhausted', () => {
    const { service } = createHarness();

    try {
      service.assertHasCredits({ credits: 0 });
      fail('expected PaymentRequiredException');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentRequiredException);
      expect((error as PaymentRequiredException).getStatus()).toBe(402);
      expect((error as PaymentRequiredException).getResponse()).toEqual({
        statusCode: 402,
        message: 'analysis.messages.no_credits',
        creditsRemaining: 0,
      });
    }
  });
});

describe('UsersService.getProfile / toProfile', () => {
  it('throws 404 when the JWT subject no longer exists', async () => {
    const { service, prisma } = createHarness();
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.getProfile('deleted-user')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('maps an account to a profile without leaking the password hash', async () => {
    const { service } = createHarness();

    const user = await service.getProfile(userRow.id);
    const profile = service.toProfile(user);

    expect(profile).toEqual({
      id: userRow.id,
      email: userRow.email,
      fullName: userRow.fullName,
      role: Role.RECRUITER,
      credits: 50,
      isActive: true,
      lastLoginAt: null,
      createdAt: userRow.createdAt,
      subscription: {
        id: subRow.id,
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        creditsPerCycle: 50,
        creditsUsed: 3,
        currentPeriodStart: subRow.currentPeriodStart,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
    expect(profile).not.toHaveProperty('passwordHash');
  });

  it('reports a null subscription for accounts without a billing record', () => {
    const { service } = createHarness();

    const profile = service.toProfile({ ...userRow, subscription: null });

    expect(profile.subscription).toBeNull();
  });
});

describe('UsersService.listUsers (SUPER_ADMIN)', () => {
  it('returns a paginated envelope with credit circulation', async () => {
    const { service, prisma } = createHarness();

    const result = await service.listUsers({
      page: 2,
      limit: 5,
      role: Role.RECRUITER,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: Role.RECRUITER },
      include: { subscription: true },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(result.message).toBe('users.messages.list');
    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({
      total: 1,
      page: 2,
      limit: 5,
      pages: 1,
      creditsInCirculation: 50,
    });
  });

  it('falls back to the first page and matches email/full name on search', async () => {
    const { service, prisma } = createHarness();

    await service.listUsers({ search: ' nadia ' });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { email: { contains: 'nadia', mode: 'insensitive' } },
            { fullName: { contains: 'nadia', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
      }),
    );
  });
});

describe('UsersService.grantCredits (SUPER_ADMIN)', () => {
  it('tops up the balance and mirrors the top-up on the subscription', async () => {
    const { service, tx } = createHarness();

    const user = await service.grantCredits(userRow.id, { credits: 25 });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: userRow.id },
      data: { credits: { increment: 25 } },
    });
    expect(tx.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: userRow.id },
        create: expect.objectContaining({ plan: SubscriptionPlan.FREE_TRIAL }),
        update: { creditsPerCycle: { increment: 25 } },
      }),
    );
    expect(user.subscription).not.toBeNull();
  });

  it('throws 404 for an unknown account', async () => {
    const { service, prisma, tx } = createHarness();
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.grantCredits('missing-user', { credits: 10 }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.updateSubscription (SUPER_ADMIN)', () => {
  it('applies plan/status changes and resets usage when asked', async () => {
    const { service, tx } = createHarness();

    await service.updateSubscription(userRow.id, {
      plan: SubscriptionPlan.ENTERPRISE,
      status: SubscriptionStatus.ACTIVE,
      creditsPerCycle: 1000,
      resetUsage: true,
      grantCredits: 100,
      currentPeriodEnd: '2026-02-01T00:00:00.000Z',
    });

    const upsertArg = tx.subscription.upsert.mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(upsertArg.update).toMatchObject({
      plan: SubscriptionPlan.ENTERPRISE,
      status: SubscriptionStatus.ACTIVE,
      creditsPerCycle: 1000,
      creditsUsed: 0,
      currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    });
    expect(upsertArg.update.currentPeriodStart).toBeInstanceOf(Date);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: userRow.id },
      data: { credits: { increment: 100 } },
    });
  });

  it('creates a FREE_TRIAL subscription when the account has none yet', async () => {
    const { service, tx } = createHarness();

    await service.updateSubscription(userRow.id, {});

    expect(tx.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: userRow.id },
        create: expect.objectContaining({
          userId: userRow.id,
          plan: SubscriptionPlan.FREE_TRIAL,
          status: SubscriptionStatus.ACTIVE,
          creditsPerCycle: 5,
          cancelAtPeriodEnd: false,
        }),
      }),
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown account', async () => {
    const { service, prisma } = createHarness();
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.updateSubscription('missing-user', {}),
    ).rejects.toThrow(NotFoundException);
  });
});
