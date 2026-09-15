import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PdfExtractorService } from './pdf-extractor.service';
import { AI_PROVIDER_TOKEN } from '../ai/interfaces/ai-provider.interface';
import type { ICvDataExtractor } from '../ai/interfaces/ai-provider.interface';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfExtractorService,
    @Inject(AI_PROVIDER_TOKEN) private readonly ai: ICvDataExtractor,
  ) {}

  async parseAndCreateCandidate(file: Express.Multer.File, fileUrl?: string) {
    const rawText = await this.pdf.extractText(file.buffer);
    const structured = await this.ai.extractStructuredCv(rawText);

    const candidate = await this.prisma.candidate.create({
      data: {
        fullName: structured.fullName,
        email: structured.email,
        phone: structured.phone,
        location: structured.location,
        title: structured.title,
        summary: structured.summary,
        skills: structured.skills ?? [],
        languages: structured.languages ?? [],
        rawText,
        structured: structured as any,
        fileName: file.originalname,
        fileUrl,
        status: 'PARSED',
        yearsOfExp: structured.yearsOfExperience,
      },
    });

    return {
      message: 'parser.messages.parse_success',
      data: candidate,
    };
  }

  async reparseCandidate(candidateId: string) {
    const existing = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });
    if (!existing) return { message: 'candidates.messages.not_found' };
    if (!existing.rawText) return { message: 'parser.messages.no_raw_text' };

    const structured = await this.ai.extractStructuredCv(existing.rawText);
    const updated = await this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        fullName: structured.fullName,
        email: structured.email ?? existing.email,
        phone: structured.phone,
        location: structured.location,
        title: structured.title,
        summary: structured.summary,
        skills: structured.skills ?? [],
        languages: structured.languages ?? [],
        structured: structured as any,
        status: 'PARSED',
        yearsOfExp: structured.yearsOfExperience,
      },
    });
    return { message: 'parser.messages.parse_success', data: updated };
  }
}
