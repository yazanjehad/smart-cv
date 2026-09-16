import { BadRequestException } from '@nestjs/common';
import { MatchStatus, Role } from '@prisma/client';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';
import type {
  AnalysisResult,
  ParsedCv,
  ParsedJob,
} from '../ai/interfaces/ai-provider.interface';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UsersService } from '../users/users.service';
import {
  AnalyzeInput,
  AnalysisService,
  deriveMatchStatus,
} from './analysis.service';

const parsedCv: ParsedCv = {
  fullName: 'Yazan Almasri',
  email: 'yazan@example.com',
  title: 'Senior Backend Engineer',
  skills: ['NestJS', 'PostgreSQL'],
  languages: ['English'],
  experience: [],
  education: [],
  yearsOfExperience: 7,
};

const parsedJob: ParsedJob = {
  title: 'Senior Backend Engineer',
  requiredHardSkills: ['NestJS', 'PostgreSQL', 'Kubernetes'],
  softSkills: ['communication'],
  domainKeywords: ['backend services'],
  requirements: ['5+ years of Node.js experience'],
  seniorityLevel: 'senior',
  minYearsExperience: 5,
};

const evaluation: AnalysisResult = {
  matchScore: 62,
  strengths: ['7 years of backend experience'],
  missingSkills: ['Kubernetes'],
  reasoning: 'Strong stack overlap, missing orchestration skills.',
  tailoredAdvice: {
    summary: 'Highlight Redis caching impact.',
    rewrittenBulletPoints: [
      {
        original: 'Built APIs',
        tailored: 'Engineered high-throughput REST APIs',
        targetKeywords: ['backend services'],
        section: 'experience',
      },
    ],
    skillsToAdd: ['Kubernetes'],
    keywordsToInclude: ['NestJS'],
    actionableSteps: ['Quantify Redis caching gains.'],
  },
};

const pdfFile = {
  fieldname: 'cvFile',
  originalname: 'cv.pdf',
  mimetype: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 test'),
  size: 13,
} as Express.Multer.File;

const jobSeekerBase: AuthenticatedUser = {
  id: 'user-1',
  email: 'job.seeker@example.com',
  fullName: 'Yazan Almasri',
  role: Role.JOB_SEEKER,
  credits: 5,
  isActive: true,
};

/** Builds the service with a mocked Prisma/Gemini stack and the real credit guard. */
function createHarness(
  options: { credits?: number; updateManyCount?: number } = {},
) {
  const user: AuthenticatedUser = {
    ...jobSeekerBase,
    credits: options.credits ?? 5,
  };

  const created = {
    id: 'history-1',
    userId: user.id,
    candidateId: 'candidate-1',
    jobId: 'job-1',
    matchScore: evaluation.matchScore,
    status: MatchStatus.SHORTLISTED,
    strengths: evaluation.strengths,
    missingSkills: evaluation.missingSkills,
    reasoning: evaluation.reasoning,
    tailoredAdvice: evaluation.tailoredAdvice,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const tx = {
    candidate: { create: jest.fn().mockResolvedValue({ id: 'candidate-1' }) },
    job: { create: jest.fn().mockResolvedValue({ id: 'job-1' }) },
    analysisHistory: { create: jest.fn().mockResolvedValue(created) },
    user: {
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.updateManyCount ?? 1 }),
    },
    subscription: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };

  const prisma = {
    $transaction: jest.fn((cb: (client: unknown) => unknown) => cb(tx)),
    analysisHistory: { findMany: jest.fn().mockResolvedValue([created]) },
  };

  const gemini = {
    parseCv: jest.fn().mockResolvedValue(parsedCv),
    parseJob: jest.fn().mockResolvedValue(parsedJob),
    evaluateAndTailor: jest.fn().mockResolvedValue(evaluation),
  };

  const pdfExtractor = {
    extractText: jest.fn().mockResolvedValue('Extracted document text'),
  };

  const config = { get: jest.fn().mockReturnValue(5) };
  const users = new UsersService(prisma as never, config as never);

  const service = new AnalysisService(
    prisma as never,
    gemini as never,
    pdfExtractor as never,
    users,
  );

  return { service, prisma, tx, gemini, pdfExtractor, user, created };
}

const asInput = (
  user: AuthenticatedUser,
  overrides: Partial<AnalyzeInput> = {},
): AnalyzeInput => ({ user, ...overrides });

describe('AnalysisService.evaluate (JWT-driven pipeline)', () => {
  it('runs the full pipeline and returns role + credits from req.user', async () => {
    const { service, tx, gemini, pdfExtractor, user } = createHarness();

    const result = await service.evaluate(
      asInput(user, {
        cvFile: pdfFile,
        jobDescription: 'Senior Backend Engineer — NestJS, PostgreSQL',
      }),
    );

    expect(pdfExtractor.extractText).toHaveBeenCalledWith(pdfFile.buffer);
    expect(gemini.parseCv).toHaveBeenCalledWith('Extracted document text');
    expect(gemini.parseJob).toHaveBeenCalledWith(
      'Senior Backend Engineer — NestJS, PostgreSQL',
    );
    expect(gemini.evaluateAndTailor).toHaveBeenCalledWith(parsedCv, parsedJob);

    expect(tx.candidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: user.id }),
      }),
    );
    expect(tx.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: user.id }),
      }),
    );
    expect(tx.analysisHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          candidateId: 'candidate-1',
          jobId: 'job-1',
          status: MatchStatus.SHORTLISTED,
        }),
      }),
    );

    expect(result.message).toBe('analysis.messages.evaluated');
    expect(result.data.role).toBe(Role.JOB_SEEKER);
    expect(result.data.creditsRemaining).toBe(4);
    expect(result.data.userId).toBe(user.id);
    expect(result.data.jobTitle).toBe('Senior Backend Engineer');
    expect(result.data.parsedJob).toEqual(parsedJob);
  });

  it('deducts exactly one credit and mirrors the usage on the subscription', async () => {
    const { service, tx, user } = createHarness();
    await service.evaluate(
      asInput(user, {
        cvFile: pdfFile,
        jobDescription: 'Senior Backend Engineer',
      }),
    );

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: user.id, credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });
    expect(tx.subscription.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id },
      data: { creditsUsed: { increment: 1 } },
    });
  });

  it('falls back to the uploaded job PDF when no job text is sent', async () => {
    const { service, pdfExtractor, gemini, user } = createHarness();
    const jobFile = {
      ...pdfFile,
      fieldname: 'jobFile',
      originalname: 'job.pdf',
    };

    await service.evaluate(asInput(user, { cvFile: pdfFile, jobFile }));

    expect(pdfExtractor.extractText).toHaveBeenCalledTimes(2);
    expect(pdfExtractor.extractText).toHaveBeenCalledWith(jobFile.buffer);
    expect(gemini.parseJob).toHaveBeenCalledWith('Extracted document text');
  });

  it('rejects an unauthenticated-credit-less account with 402 before any parsing', async () => {
    const { service, pdfExtractor, gemini, user } = createHarness({
      credits: 0,
    });

    await expect(service.evaluate(asInput(user))).rejects.toThrow(
      PaymentRequiredException,
    );
    expect(pdfExtractor.extractText).not.toHaveBeenCalled();
    expect(gemini.parseCv).not.toHaveBeenCalled();
  });

  it('rolls back (402) when the atomic decrement loses the race', async () => {
    const { service, tx, user } = createHarness({ updateManyCount: 0 });

    await expect(
      service.evaluate(
        asInput(user, {
          cvFile: pdfFile,
          jobDescription: 'Senior Backend Engineer',
        }),
      ),
    ).rejects.toThrow(PaymentRequiredException);
    expect(tx.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a request without a CV before calling Gemini', async () => {
    const { service, gemini, user } = createHarness();

    await expect(
      service.evaluate(
        asInput(user, { jobDescription: 'Senior Backend Engineer' }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(gemini.parseCv).not.toHaveBeenCalled();
  });

  it('rejects a non-PDF upload', async () => {
    const { service, gemini, user } = createHarness();
    const docFile = {
      ...pdfFile,
      originalname: 'cv.docx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    await expect(
      service.evaluate(
        asInput(user, {
          cvFile: docFile,
          jobDescription: 'Senior Backend Engineer',
        }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(gemini.parseCv).not.toHaveBeenCalled();
  });

  it('rejects a request without a job description', async () => {
    const { service, gemini, user } = createHarness();

    await expect(
      service.evaluate(asInput(user, { cvFile: pdfFile })),
    ).rejects.toThrow(BadRequestException);
    expect(gemini.evaluateAndTailor).not.toHaveBeenCalled();
  });
});

describe('AnalysisService.history (per-account scoping)', () => {
  it('returns the account history with role and remaining credits', async () => {
    const { service, prisma, user } = createHarness({ credits: 3 });

    const result = await service.history(user);

    expect(prisma.analysisHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: user.id }, take: 20 }),
    );
    expect(result.message).toBe('analysis.messages.history');
    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({
      total: 1,
      creditsRemaining: 3,
      role: Role.JOB_SEEKER,
    });
  });

  it('scopes the rows to whichever account is authenticated', async () => {
    const { service, prisma } = createHarness();
    const recruiter: AuthenticatedUser = {
      ...jobSeekerBase,
      id: 'user-2',
      email: 'recruiter@company.com',
      role: Role.RECRUITER,
      credits: 50,
    };

    const result = await service.history(recruiter);

    expect(prisma.analysisHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-2' } }),
    );
    expect(result.meta.role).toBe(Role.RECRUITER);
    expect(result.meta.creditsRemaining).toBe(50);
  });
});

describe('deriveMatchStatus', () => {
  it.each([
    [100, MatchStatus.MATCHED],
    [80, MatchStatus.MATCHED],
    [79.9, MatchStatus.SHORTLISTED],
    [50, MatchStatus.SHORTLISTED],
    [49.9, MatchStatus.REJECTED],
    [0, MatchStatus.REJECTED],
  ])('maps the score %s to %s', (score, expected) => {
    expect(deriveMatchStatus(score)).toBe(expected);
  });
});
