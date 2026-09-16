import { ConflictException, UnauthorizedException } from '@nestjs/common';
import {
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const TEST_PASSWORD = 'SmartCv!2026';
const ACCESS_TOKEN = 'signed.jwt.token';

const account: User = {
  id: 'user-1',
  email: 'recruiter@company.com',
  passwordHash: bcrypt.hashSync(TEST_PASSWORD, 4),
  fullName: 'Nadia Haddad',
  role: Role.RECRUITER,
  credits: 5,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const subscription = {
  id: 'sub-1',
  userId: account.id,
  plan: SubscriptionPlan.FREE_TRIAL,
  status: SubscriptionStatus.ACTIVE,
  creditsPerCycle: 5,
  creditsUsed: 0,
  currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

/** AuthService with a mocked UsersService, real bcrypt and a stubbed JwtService. */
function createHarness(
  options: { stored?: User | null; active?: boolean } = {},
) {
  // No account by default (registration flow); pass `stored` for login flows.
  const stored = options.stored
    ? { ...options.stored, isActive: options.active ?? options.stored.isActive }
    : null;
  const profile = { ...account, subscription };

  const users = {
    findByEmail: jest.fn().mockResolvedValue(stored),
    findById: jest.fn().mockResolvedValue(stored),
    createAccount: jest.fn().mockResolvedValue(profile),
    recordLogin: jest.fn().mockResolvedValue(profile),
    getProfile: jest.fn().mockResolvedValue(profile),
    toProfile: jest.fn((user: unknown) =>
      (UsersService.prototype.toProfile as (u: unknown) => unknown)(user),
    ),
  };

  const jwt = { signAsync: jest.fn().mockResolvedValue(ACCESS_TOKEN) };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'app.jwt.expiresIn') return '1d';
      if (key === 'app.jwt.saltRounds') return 4;
      return fallback;
    }),
  };

  const service = new AuthService(
    users as never,
    jwt as never,
    config as never,
  );
  return { service, users, jwt, config, profile, stored };
}

describe('AuthService.register', () => {
  it('hashes the password and returns a signed token with the profile', async () => {
    const { service, users, jwt } = createHarness();

    const result = await service.register({
      email: 'new.user@example.com',
      password: TEST_PASSWORD,
      fullName: 'New User',
    });

    const created = users.createAccount.mock.calls[0][0] as {
      email: string;
      passwordHash: string;
      fullName?: string;
      role?: Role;
    };
    expect(users.findByEmail).toHaveBeenCalledWith('new.user@example.com');
    expect(created.email).toBe('new.user@example.com');
    expect(created.fullName).toBe('New User');
    expect(created.role).toBeUndefined();
    expect(created.passwordHash).not.toBe(TEST_PASSWORD);
    expect(bcrypt.compareSync(TEST_PASSWORD, created.passwordHash)).toBe(true);

    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: account.id,
      email: account.email,
      role: account.role,
    });
    expect(result.message).toBe('auth.messages.registered');
    expect(result.data.accessToken).toBe(ACCESS_TOKEN);
    expect(result.data.tokenType).toBe('Bearer');
    expect(result.data.expiresIn).toBe('1d');
    expect(result.data.user.subscription?.plan).toBe(
      SubscriptionPlan.FREE_TRIAL,
    );
    expect(result.data.user).not.toHaveProperty('passwordHash');
  });

  it('forwards the self-selected recruiter role', async () => {
    const { service, users } = createHarness();

    await service.register({
      email: 'recruiter2@company.com',
      password: TEST_PASSWORD,
      role: Role.RECRUITER,
    });

    expect(users.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.RECRUITER }),
    );
  });

  it('rejects an already-registered email with 409 and never touches bcrypt', async () => {
    const { service, users } = createHarness({ stored: account });

    await expect(
      service.register({ email: account.email, password: TEST_PASSWORD }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.register({ email: account.email, password: TEST_PASSWORD }),
    ).rejects.toThrow('auth.errors.email_taken');
    expect(users.createAccount).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  it('issues a token for valid credentials and records the login', async () => {
    const { service, users, jwt } = createHarness({ stored: account });

    const result = await service.login({
      email: account.email,
      password: TEST_PASSWORD,
    });

    expect(users.recordLogin).toHaveBeenCalledWith(account.id);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: account.id,
      email: account.email,
      role: Role.RECRUITER,
    });
    expect(result.message).toBe('auth.messages.logged_in');
    expect(result.data.accessToken).toBe(ACCESS_TOKEN);
    expect(result.data.user.id).toBe(account.id);
  });

  it('rejects a wrong password with 401', async () => {
    const { service, users } = createHarness({ stored: account });

    await expect(
      service.login({ email: account.email, password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(users.recordLogin).not.toHaveBeenCalled();
  });

  it('rejects an unknown email with 401', async () => {
    const { service } = createHarness();

    await expect(
      service.login({ email: 'ghost@example.com', password: TEST_PASSWORD }),
    ).rejects.toThrow('auth.errors.invalid_credentials');
  });

  it('rejects a deactivated account with 401', async () => {
    const { service, users } = createHarness({
      stored: account,
      active: false,
    });

    await expect(
      service.login({ email: account.email, password: TEST_PASSWORD }),
    ).rejects.toThrow('auth.errors.inactive_account');
    expect(users.recordLogin).not.toHaveBeenCalled();
  });
});

describe('AuthService.profile', () => {
  it('returns the JWT account profile with its subscription', async () => {
    const { service, users } = createHarness();

    const result = await service.profile(account.id);

    expect(users.getProfile).toHaveBeenCalledWith(account.id);
    expect(result.message).toBe('auth.messages.profile');
    expect(result.data.role).toBe(Role.RECRUITER);
    expect(result.data.credits).toBe(5);
    expect(result.data.subscription?.creditsUsed).toBe(0);
    expect(result.data).not.toHaveProperty('passwordHash');
  });
});
