import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import {
  AnalyzeInput,
  AnalysisService,
  deriveMatchStatus,
} from './analysis.service';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';
import type {
  AnalysisResult,
  ParsedCv,
  ParsedJob,
} from '../ai/interfaces/ai-provider.interface';

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

function createHarness(
  options: { credits?: number; updateManyCount?: number } = {},
) {
  const user = {
    id: 'user-1',
    sessionToken: 'session-1',
    email: null,
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
  };

  const prisma = {
    $transaction: jest.fn((cb: (client: unknown) => unknown) => cb(tx)),
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.credits === -1 ? null : user),
    },
    analysisHistory: { findMany: jest.fn().mockResolvedValue([created]) },
  };

  const gemini = {
    parseCv: jest.fn().mockResolvedValue(parsedCv),
    parseJob: jest.fn().mockResolvedValue(parsedJob),
    evaluateAndTailor: jest.fn().mockResolvedValue(evaluation),
  };

  const pdfExtractor = {
    extractText: jest.fn().mockResolvedValue('raw resume text'),
  };

  const users = {
    resolveSessionToken: jest.fn().mockReturnValue('session-1'),
    getOrCreateBySessionToken: jest.fn().mockResolvedValue(user),
    assertHasCredits: jest.fn((candidate: { credits: number }) => {
      if (candidate.credits <= 0) {
        throw new PaymentRequiredException('analysis.messages.no_credits');
      }
    }),
  };

  const service = new AnalysisService(
    prisma as never,
    gemini as never,
    pdfExtractor as never,
    users as never,
  );

  return { service, prisma, tx, gemini, pdfExtractor, users };
}
describe('AnalysisService.evaluate', () => {
  it('runs the full pipeline and persists everything in one transaction', async () => {
    const { service, prisma, tx, gemini, pdfExtractor } = createHarness();
    const input: AnalyzeInput = {
      cvFile: pdfFile,
      jobDescription: 'We need a Senior Backend Engineer with NestJS.',
    };

    const result = await service.evaluate(input);

    expect(pdfExtractor.extractText).toHaveBeenCalledTimes(1);
    expect(gemini.parseCv).toHaveBeenCalledWith('raw resume text');
    expect(gemini.parseJob).toHaveBeenCalledWith(input.jobDescription);
    expect(gemini.evaluateAndTailor).toHaveBeenCalledWith(parsedCv, parsedJob);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(tx.candidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        email: 'yazan@example.com',
      }),
    });
    expect(tx.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: 'Senior Backend Engineer' }),
    });
    expect(tx.analysisHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        candidateId: 'candidate-1',
        jobId: 'job-1',
        matchScore: 62,
        status: MatchStatus.SHORTLISTED,
      }),
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });

    expect(result.message).toBe('analysis.messages.evaluated');
    expect(result.data.creditsRemaining).toBe(4);
    expect(result.data.sessionToken).toBe('session-1');
    expect(result.data.parsedJob).toEqual(parsedJob);
    expect(result.data.tailoredAdvice).toEqual(evaluation.tailoredAdvice);
  });

  it('reads the job PDF when no job description text is provided', async () => {
    const { service, pdfExtractor } = createHarness();

    await service.evaluate({ cvFile: pdfFile, jobFile: pdfFile });

    expect(pdfExtractor.extractText).toHaveBeenCalledTimes(2);
  });

  it('rejects a request without a CV before calling Gemini', async () => {
    const { service, gemini } = createHarness();

    await expect(
      service.evaluate({ jobDescription: 'Senior Backend Engineer' }),
    ).rejects.toThrow(BadRequestException);
    expect(gemini.parseCv).not.toHaveBeenCalled();
  });

  it('rejects a non-PDF upload', async () => {
    const { service } = createHarness();
    const txt = { ...pdfFile, mimetype: 'text/plain', originalname: 'cv.txt' };

    await expect(
      service.evaluate({ cvFile: txt, jobDescription: 'JD' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a request without a job description', async () => {
    const { service } = createHarness();

    await expect(service.evaluate({ cvFile: pdfFile })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws 402 before extraction when the session has no credits', async () => {
    const { service, pdfExtractor } = createHarness({ credits: 0 });

    await expect(
      service.evaluate({ cvFile: pdfFile, jobDescription: 'JD' }),
    ).rejects.toThrow(PaymentRequiredException);
    expect(pdfExtractor.extractText).not.toHaveBeenCalled();
  });

  it('rolls back with 402 when the credit decrement loses the race', async () => {
    const { service } = createHarness({ updateManyCount: 0 });

    await expect(
      service.evaluate({ cvFile: pdfFile, jobDescription: 'JD' }),
    ).rejects.toThrow(PaymentRequiredException);
  });
});

describe('AnalysisService.history', () => {
  it('returns the session history with remaining credits', async () => {
    const { service } = createHarness({ credits: 3 });

    const result = await service.history('session-1');

    expect(result.message).toBe('analysis.messages.history');
    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, creditsRemaining: 3 });
  });

  it('requires a session id', async () => {
    const { service } = createHarness();

    await expect(service.history(null)).rejects.toThrow(BadRequestException);
  });

  it('throws 404 for an unknown session', async () => {
    const { service } = createHarness({ credits: -1 });

    await expect(service.history('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('deriveMatchStatus', () => {
  it('maps scores to deterministic statuses', () => {
    expect(deriveMatchStatus(95)).toBe(MatchStatus.MATCHED);
    expect(deriveMatchStatus(80)).toBe(MatchStatus.MATCHED);
    expect(deriveMatchStatus(62)).toBe(MatchStatus.SHORTLISTED);
    expect(deriveMatchStatus(50)).toBe(MatchStatus.SHORTLISTED);
    expect(deriveMatchStatus(49)).toBe(MatchStatus.REJECTED);
  });
});
