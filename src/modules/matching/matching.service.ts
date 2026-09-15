import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AI_PROVIDER_TOKEN } from '../ai/interfaces/ai-provider.interface';
import type { ICvDataExtractor } from '../ai/interfaces/ai-provider.interface';
import { MatchRequestDto } from './dto/match.dto';

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER_TOKEN) private readonly ai: ICvDataExtractor,
  ) {}

  async match(dto: MatchRequestDto) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: dto.candidateId },
    });
    if (!candidate)
      throw new NotFoundException('candidates.messages.not_found');

    const job = await this.prisma.job.findUnique({ where: { id: dto.jobId } });
    if (!job) throw new NotFoundException('jobs.messages.not_found');

    const profile = (candidate.structured as any) ?? {
      fullName: candidate.fullName,
      skills: candidate.skills,
      summary: candidate.summary,
    };

    const evaluation = await this.ai.evaluateMatch(
      profile,
      job.description,
      job.requirements,
    );

    const status =
      evaluation.score >= 80
        ? MatchStatus.MATCHED
        : evaluation.score >= 50
          ? MatchStatus.SHORTLISTED
          : MatchStatus.REJECTED;

    const saved = await this.prisma.matchResult.upsert({
      where: {
        candidateId_jobId: { candidateId: candidate.id, jobId: job.id },
      },
      create: {
        candidateId: candidate.id,
        jobId: job.id,
        score: evaluation.score,
        status,
        strengths: evaluation.strengths,
        missingSkills: evaluation.missingSkills,
        reasoning: evaluation.reasoning,
        rawOutput: evaluation as any,
      },
      update: {
        score: evaluation.score,
        status,
        strengths: evaluation.strengths,
        missingSkills: evaluation.missingSkills,
        reasoning: evaluation.reasoning,
        rawOutput: evaluation as any,
      },
    });

    return { message: 'matching.messages.evaluated', data: saved };
  }

  async topCandidates(jobId: string, limit = 10) {
    const rows = await this.prisma.matchResult.findMany({
      where: { jobId },
      include: { candidate: true },
      orderBy: { score: 'desc' },
      take: Math.min(Number(limit) || 10, 50),
    });
    return { message: 'matching.messages.top_candidates', data: rows };
  }

  async candidateMatches(candidateId: string) {
    const rows = await this.prisma.matchResult.findMany({
      where: { candidateId },
      include: { job: true },
      orderBy: { score: 'desc' },
    });
    return { message: 'matching.messages.candidate_matches', data: rows };
  }
}
