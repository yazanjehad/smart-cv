import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateJobDto, UpdateJobDto } from './dto/job.dto';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateJobDto) {
    return this.prisma.job
      .create({
        data: {
          ...dto,
          requirements: dto.requirements ?? [],
          skills: dto.skills ?? [],
        },
      })
      .then((data) => ({ message: 'jobs.messages.created', data }));
  }

  async findAll(page = 1, limit = 10) {
    const p = Number(page) || 1;
    const l = Math.min(Number(limit) || 10, 100);
    const [total, items] = await Promise.all([
      this.prisma.job.count(),
      this.prisma.job.findMany({
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      message: 'jobs.messages.list',
      data: items,
      meta: { total, page: p, limit: l },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.job.findUnique({
      where: { id },
      include: {
        matches: { include: { candidate: true }, orderBy: { score: 'desc' } },
      },
    });
    if (!item) throw new NotFoundException('jobs.messages.not_found');
    return { message: 'jobs.messages.detail', data: item };
  }

  async update(id: string, dto: UpdateJobDto) {
    await this.ensureExists(id);
    const data = await this.prisma.job.update({
      where: { id },
      data: dto as any,
    });
    return { message: 'jobs.messages.updated', data };
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.job.delete({ where: { id } });
    return { message: 'jobs.messages.deleted' };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.job.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('jobs.messages.not_found');
  }
}
