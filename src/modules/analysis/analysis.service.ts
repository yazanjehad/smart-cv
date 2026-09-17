import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MatchStatus, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GeminiAiService } from '../ai/services/gemini-ai.service';
import { PdfExtractorService } from '../parser/pdf-extractor.service';
import { UsersService } from '../users/users.service';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type {
  AnalysisResult,
  ParsedCv,
  ParsedJob,
  TailoredAdvice,
} from '../ai/interfaces/ai-provider.interface';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface AnalyzeInput {
  /** JWT-authenticated owner of the run (replaces the old session token). */
  user: AuthenticatedUser;
  cvFile?: Express.Multer.File;
  jobFile?: Express.Multer.File;
  jobDescription?: string;
}

export interface AnalysisResponsePayload {
  id: string;
  userId: string;
  candidateId: string;
  jobId: string;
  candidateName?: string | null;
  jobTitle: string;
  matchScore: number;
  status: MatchStatus;
  strengths: string[];
  missingSkills: string[];
  reasoning?: string | null;
  tailoredAdvice: TailoredAdvice | null;
  parsedCv: ParsedCv;
  parsedJob: ParsedJob;
  createdAt: Date;
  role: Role;
  creditsRemaining: number;
}

/** Deterministic score -> status thresholds shared by the pipeline. */
export function deriveMatchStatus(score: number): MatchStatus {
  if (score >= 80) return MatchStatus.MATCHED;
  if (score >= 50) return MatchStatus.SHORTLISTED;
  return MatchStatus.REJECTED;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiAiService,
    private readonly pdfExtractor: PdfExtractorService,
    private readonly users: UsersService,
  ) {}
  /**
   * Unified end-to-end pipeline:
   * auth + credit check -> extract -> parse (parallel) -> score + tailor ->
   * persist atomically -> localized response.
   */
  async evaluate(
    input: AnalyzeInput,
  ): Promise<{ message: string; data: AnalysisResponsePayload }> {
    // 1) Authenticated user + pre-flight usage-limit (credit) check.
    const { user } = input;
    this.users.assertHasCredits(user);

    // 2) PDF / text extraction.
    if (!input.cvFile) {
      throw new BadRequestException('analysis.messages.cv_required');
    }
    this.assertValidPdf(input.cvFile, 'analysis.messages.invalid_pdf');
    const cvText = (
      await this.pdfExtractor.extractText(input.cvFile.buffer)
    ).trim();
    if (!cvText) {
      throw new BadRequestException('analysis.messages.cv_unreadable');
    }

    let jobText = (input.jobDescription ?? '').trim();
    if (!jobText && input.jobFile) {
      this.assertValidPdf(input.jobFile, 'analysis.messages.invalid_pdf');
      jobText = (
        await this.pdfExtractor.extractText(input.jobFile.buffer)
      ).trim();
    }
    if (!jobText) {
      throw new BadRequestException('analysis.messages.job_required');
    }

    // 3) Parallel Gemini parsing (CV + job).
    const [parsedCv, parsedJob] = await Promise.all([
      this.gemini.parseCv(cvText),
      this.gemini.parseJob(jobText),
    ]);

    // 4) Deterministic scoring + tailored CV advice.
    const evaluation: AnalysisResult = await this.gemini.evaluateAndTailor(
      parsedCv,
      parsedJob,
    );
    const status = deriveMatchStatus(evaluation.matchScore);
    // 5) + 6) Persist everything and deduct exactly one credit, atomically.
    const { history, creditsRemaining } = await this.prisma.$transaction(
      async (tx) => {
        const candidate = await tx.candidate.create({
          data: {
            userId: user.id,
            fullName: parsedCv.fullName,
            email: parsedCv.email ?? null,
            phone: parsedCv.phone,
            location: parsedCv.location,
            title: parsedCv.title,
            summary: parsedCv.summary,
            skills: parsedCv.skills ?? [],
            languages: parsedCv.languages ?? [],
            rawText: cvText,
            structured: parsedCv as any,
            fileName: input.cvFile?.originalname,
            status: 'PARSED',
            yearsOfExp: parsedCv.yearsOfExperience,
          },
        });

        const job = await tx.job.create({
          data: {
            userId: user.id,
            title: parsedJob.title ?? 'Untitled position',
            company: parsedJob.company,
            location: parsedJob.location,
            employmentType: parsedJob.employmentType,
            description: jobText,
            requirements: parsedJob.requirements ?? [],
            skills: parsedJob.requiredHardSkills ?? [],
            structured: parsedJob as any,
            minYearsExp: parsedJob.minYearsExperience,
          },
        });

        const created = await tx.analysisHistory.create({
          data: {
            userId: user.id,
            candidateId: candidate.id,
            jobId: job.id,
            matchScore: evaluation.matchScore,
            status,
            strengths: evaluation.strengths,
            missingSkills: evaluation.missingSkills,
            reasoning: evaluation.reasoning,
            tailoredAdvice: evaluation.tailoredAdvice as any,
          },
        });

        const deduction = await tx.user.updateMany({
          where: { id: user.id, credits: { gt: 0 } },
          data: { credits: { decrement: 1 } },
        });
        if (deduction.count === 0) {
          // Rolls the transaction back, including candidate/job/history rows.
          throw new PaymentRequiredException('analysis.messages.no_credits', {
            creditsRemaining: 0,
          });
        }

        // Usage analytics for SUPER_ADMIN consumption monitoring (a no-op when
        // the account has no subscription row yet).
        await tx.subscription.updateMany({
          where: { userId: user.id },
          data: { creditsUsed: { increment: 1 } },
        });

        return {
          history: created,
          creditsRemaining: Math.max(0, user.credits - 1),
        };
      },
    );

    this.logger.log(
      `Analysis ${history.id} persisted (score=${evaluation.matchScore}, status=${status})`,
    );
    // 7) Localized envelope (translated by I18nResponseInterceptor).
    return {
      message: 'analysis.messages.evaluated',
      data: {
        id: history.id,
        userId: history.userId,
        candidateId: history.candidateId,
        jobId: history.jobId,
        candidateName: parsedCv.fullName ?? null,
        jobTitle: parsedJob.title ?? 'Untitled position',
        matchScore: history.matchScore,
        status: history.status,
        strengths: history.strengths,
        missingSkills: history.missingSkills,
        reasoning: history.reasoning,
        tailoredAdvice:
          history.tailoredAdvice as unknown as TailoredAdvice | null,
        parsedCv,
        parsedJob,
        createdAt: history.createdAt,
        role: user.role,
        creditsRemaining,
      },
    };
  }

  /** Unified analysis history for the JWT-authenticated account. */
  async history(user: AuthenticatedUser) {
    const rows = await this.prisma.analysisHistory.findMany({
      where: { userId: user.id },
      include: {
        candidate: { select: { id: true, fullName: true, title: true } },
        job: { select: { id: true, title: true, company: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      message: 'analysis.messages.history',
      data: rows,
      meta: {
        total: rows.length,
        creditsRemaining: user.credits,
        role: user.role,
      },
    };
  }

  private assertValidPdf(file: Express.Multer.File, message: string): void {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname?.toLowerCase().endsWith('.pdf');
    if (!isPdf || file.buffer.length === 0) {
      throw new BadRequestException(message);
    }
    if (file.buffer.length > MAX_FILE_BYTES) {
      throw new BadRequestException('analysis.messages.file_too_large');
    }
  }
}
