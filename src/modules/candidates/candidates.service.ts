import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCandidateDto, UpdateCandidateDto } from './dto/candidate.dto';

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCandidateDto) {
    return this.prisma.candidate
      .create({
        data: {
          ...dto,
          skills: dto.skills ?? [],
          languages: dto.languages ?? [],
        },
      })
      .then((data) => ({ message: 'candidates.messages.created', data }));
  }

  async findAll(query: { search?: string; page?: number; limit?: number }) {
    const page = Number(query.page ?? 1) || 1;
    const limit = Math.min(Number(query.limit ?? 10) || 10, 100);
    const where = query.search
      ? {
          OR: [
            {
              fullName: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            { email: { contains: query.search, mode: 'insensitive' as const } },
            { title: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.candidate.count({ where }),
      this.prisma.candidate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      message: 'candidates.messages.list',
      data: items,
      meta: { total, page, limit },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        matches: { include: { job: true }, orderBy: { score: 'desc' } },
      },
    });
    if (!item) throw new NotFoundException('candidates.messages.not_found');
    return { message: 'candidates.messages.detail', data: item };
  }

  async update(id: string, dto: UpdateCandidateDto) {
    await this.ensureExists(id);
    const data = await this.prisma.candidate.update({
      where: { id },
      data: dto as any,
    });
    return { message: 'candidates.messages.updated', data };
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.candidate.delete({ where: { id } });
    return { message: 'candidates.messages.deleted' };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.candidate.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('candidates.messages.not_found');
  }
}
