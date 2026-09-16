import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

/** Shared password of the RBAC demo accounts created by `prisma db seed`. */
const DEMO_PASSWORD = 'SmartCv!2026';
const SEEDED = {
  superAdmin: 'super.admin@smartcv.dev',
  recruiter: 'recruiter@company.com',
  jobSeeker: 'job.seeker@example.com',
} as const;

describe('smart_cv_api (e2e) — JWT auth, RBAC & credits', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  /** Accounts created by these tests, removed again in `afterAll`. */
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // mirrors src/main.ts
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  /** Registers a throwaway account and remembers it for cleanup. */
  async function register(role: Role = Role.JOB_SEEKER) {
    const email = `e2e.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: DEMO_PASSWORD, fullName: 'E2E Runner', role })
      .expect(201);

    const data = res.body.data as {
      accessToken: string;
      user: { id: string; email: string; role: Role; credits: number };
    };
    createdUserIds.push(data.user.id);
    return { email, accessToken: data.accessToken, user: data.user };
  }

  async function login(email: string, password: string = DEMO_PASSWORD) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.data.accessToken as string;
  }

  const bearer = (token: string) => `Bearer ${token}`;
  const isArabic = (value: string) => /[\u0600-\u06FF]/.test(value);

  describe('health', () => {
    it('GET /api → Hello World!', async () => {
      const res = await request(app.getHttpServer()).get('/api').expect(200);
      expect(res.text).toBe('Hello World!');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('creates a JOB_SEEKER with free-trial credits and returns a JWT', async () => {
      const { accessToken, user, email } = await register();

      expect(user.email).toBe(email);
      expect(user.role).toBe(Role.JOB_SEEKER);
      expect(user.credits).toBe(5);
      expect(accessToken.split('.')).toHaveLength(3);

      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', bearer(accessToken))
        .expect(200);
      expect(me.body.data.subscription.plan).toBe('FREE_TRIAL');
      expect(me.body.data).not.toHaveProperty('passwordHash');
    });

    it('creates a RECRUITER when the role is self-selected', async () => {
      const { user } = await register(Role.RECRUITER);
      expect(user.role).toBe(Role.RECRUITER);
    });

    it('rejects a self-assigned SUPER_ADMIN role with a localized 400 (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Accept-Language', 'ar')
        .send({
          email: `e2e.escalation.${Date.now()}@example.com`,
          password: DEMO_PASSWORD,
          role: Role.SUPER_ADMIN,
        })
        .expect(400);

      expect(isArabic(res.body.message)).toBe(true);
    });

    it('rejects a duplicate email with 409', async () => {
      const { email } = await register();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: DEMO_PASSWORD })
        .expect(409);
      expect(res.body.message).toBe('This email address is already registered');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it.each(Object.entries(SEEDED))(
      'issues a token for the seeded %s account (%s)',
      async (_label, email) => {
        const token = await login(email);
        expect(token.split('.')).toHaveLength(3);
      },
    );

    it('rejects wrong credentials with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEEDED.recruiter, password: 'not-the-password' })
        .expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    });
  });

  describe('JwtAuthGuard', () => {
    it('rejects a missing token with a localized 401 (ar)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Accept-Language', 'ar')
        .expect(401);
      expect(isArabic(res.body.message)).toBe(true);
    });

    it('rejects an unauthenticated analysis run with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/analysis/evaluate')
        .field('jobDescription', 'Senior Backend Engineer')
        .expect(401);
    });

    it('rejects a tampered token with 401 and localizes the message', async () => {
      const token = await login(SEEDED.recruiter);
      const tampered = `${token.split('.').slice(0, 2).join('.')}.deadbeef`;

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', bearer(tampered))
        .expect(401);
      expect(res.body.message).toBe(
        'Authentication is required to access this resource',
      );
    });

    it('rejects a token whose account no longer exists with a localized 401', async () => {
      const { accessToken, user } = await register();
      await prisma.user.deleteMany({ where: { id: user.id } });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', bearer(accessToken))
        .expect(401);
      expect(res.body.message).not.toBe('auth.errors.inactive_account');
    });
  });

  describe('RBAC (@Roles)', () => {
    it('forbids a JOB_SEEKER from the recruiter job board (localized 403, ar)', async () => {
      const token = await login(SEEDED.jobSeeker);

      const res = await request(app.getHttpServer())
        .get('/api/jobs')
        .set('Authorization', bearer(token))
        .set('Accept-Language', 'ar')
        .expect(403);
      expect(isArabic(res.body.message)).toBe(true);
    });

    it('forbids a JOB_SEEKER from the recruiter-only matching evaluator', async () => {
      const token = await login(SEEDED.jobSeeker);

      await request(app.getHttpServer())
        .post('/api/matching/evaluate')
        .set('Authorization', bearer(token))
        .send({ jobId: 'ignored-because-the-guard-runs-first' })
        .expect(403);
    });

    it('allows a RECRUITER into the job board', async () => {
      const token = await login(SEEDED.recruiter);

      await request(app.getHttpServer())
        .get('/api/jobs')
        .set('Authorization', bearer(token))
        .expect(200);
    });

    it('allows a JOB_SEEKER to read their own candidate matches', async () => {
      const token = await login(SEEDED.jobSeeker);

      const res = await request(app.getHttpServer())
        .get('/api/matching/candidates/00000000-0000-0000-0000-000000000000')
        .set('Authorization', bearer(token));
      expect(res.status).not.toBe(403);
    });

    it('forbids a RECRUITER from the SUPER_ADMIN account list', async () => {
      const token = await login(SEEDED.recruiter);

      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', bearer(token))
        .expect(403);
    });

    it('lets the SUPER_ADMIN list accounts with credit circulation', async () => {
      const token = await login(SEEDED.superAdmin);

      const res = await request(app.getHttpServer())
        .get('/api/v1/users?limit=5')
        .set('Authorization', bearer(token))
        .expect(200);

      expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
      expect(res.body.meta.creditsInCirculation).toBeGreaterThan(0);
      expect(res.body.data[0]).not.toHaveProperty('passwordHash');
    });

    it('lets the SUPER_ADMIN top up an account (subscription mirrored)', async () => {
      const { user } = await register(Role.JOB_SEEKER);
      const token = await login(SEEDED.superAdmin);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/users/${user.id}/credits`)
        .set('Authorization', bearer(token))
        .send({ credits: 25 })
        .expect(200);

      expect(res.body.data.credits).toBe(30);
      expect(res.body.data.subscription.creditsPerCycle).toBe(30);
    });
  });

  describe('credit guard (402)', () => {
    it('blocks the pipeline before parsing when the balance is exhausted', async () => {
      const { accessToken, user } = await register(Role.JOB_SEEKER);
      await prisma.user.update({
        where: { id: user.id },
        data: { credits: 0 },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/analysis/evaluate')
        .set('Authorization', bearer(accessToken))
        .field('jobDescription', 'Senior Backend Engineer — NestJS, PostgreSQL')
        .attach('cvFile', Buffer.from('%PDF-1.4 stub, never parsed'), 'cv.pdf')
        .expect(402);

      expect(res.body.message).toBe(
        'You have used all your available credits, please upgrade to continue',
      );
      expect(res.body.creditsRemaining).toBe(0);
    });
  });

  describe('GET /api/v1/analysis/history', () => {
    it('returns the account-scoped, role-aware history envelope', async () => {
      const { accessToken } = await register(Role.JOB_SEEKER);

      const res = await request(app.getHttpServer())
        .get('/api/v1/analysis/history')
        .set('Authorization', bearer(accessToken))
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta).toEqual({
        total: 0,
        creditsRemaining: 5,
        role: Role.JOB_SEEKER,
      });
    });
  });
});
