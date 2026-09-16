import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MatchRequestDto } from './dto/match.dto';
import { MatchingService } from './matching.service';

@ApiTags('matching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('matching')
export class MatchingController {
  constructor(private readonly service: MatchingService) {}

  @Post('evaluate')
  @Roles(Role.SUPER_ADMIN, Role.RECRUITER)
  evaluate(@Body() dto: MatchRequestDto) {
    return this.service.match(dto);
  }

  @Get('jobs/:jobId/top')
  @Roles(Role.SUPER_ADMIN, Role.RECRUITER)
  top(@Param('jobId') jobId: string, @Query('limit') limit = 10) {
    return this.service.topCandidates(jobId, Number(limit));
  }

  @Get('candidates/:candidateId')
  @Roles(Role.SUPER_ADMIN, Role.RECRUITER, Role.JOB_SEEKER)
  forCandidate(@Param('candidateId') candidateId: string) {
    return this.service.candidateMatches(candidateId);
  }
}
